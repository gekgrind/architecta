import "server-only";

import {
  DestinationConfigError,
  DestinationUnsupportedError,
  type ConnectionCheck,
  type ContentDestinationAdapter,
  type DestinationConnectInput,
  type DestinationConnection,
  type DestinationContent,
  type DestinationPublishResult,
  type DestinationSession,
  type DraftContext,
  type DraftResult,
  type PublishDestinationContext,
} from "../types";
import { parseRecipientList } from "./recipients";

/**
 * The user's own Gmail mailbox — one-to-one and small-group sends.
 *
 * SCOPES — deliberately narrow, and NEVER inbox-read:
 *   openid, email      identify which Google account is connected, so the user
 *                      can see (and we can address) the right mailbox.
 *   gmail.compose      create/update drafts AND send them.
 *
 * `gmail.send` alone cannot create a draft — the Gmail API requires compose,
 * modify, or full-mail access for users.drafts.create, and `send` only permits
 * users.messages.send. `gmail.compose` is the narrowest scope that supports
 * draft-first-then-approve, and it grants NO ability to read the inbox.
 *
 * Explicitly NOT requested: gmail.readonly, gmail.metadata, gmail.modify,
 * https://mail.google.com/.
 */
export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.compose",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Refresh this far ahead of expiry so a slow request can't race the clock. */
const REFRESH_SKEW_MS = 60_000;

/**
 * A dedicated Google OAuth client, separate from the GOOGLE_CLIENT_ID used for
 * sign-in and YouTube publishing: mailbox access shouldn't widen the consent
 * screen of the app people log in with.
 */
function clientCreds() {
  const id = process.env.GOOGLE_INTEGRATION_CLIENT_ID;
  const secret = process.env.GOOGLE_INTEGRATION_CLIENT_SECRET;
  if (!id || !secret) {
    throw new DestinationConfigError(
      "Missing GOOGLE_INTEGRATION_CLIENT_ID / GOOGLE_INTEGRATION_CLIENT_SECRET"
    );
  }
  return { id, secret };
}

/** Parse a comma/semicolon-separated recipient list ("small group" sends). */
export function parseRecipients(raw: string | null | undefined): string[] {
  return parseRecipientList(raw, {
    max: 50,
    overflowMessage:
      "Gmail is for single and small-group sends — use a Brevo campaign for larger audiences",
  });
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input as never)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Strip CR/LF so a crafted subject can't inject extra headers. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildMimeMessage(args: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}): string {
  const headers = [
    `From: ${args.from}`,
    `To: ${args.to.join(", ")}`,
    `Subject: ${encodeHeader(sanitizeHeader(args.subject))}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  // Base64 the body too: it sidesteps line-length and encoding pitfalls.
  const body = Buffer.from(args.html, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error_description?: string;
  error?: string;
};

function expiryFrom(expiresIn: number | undefined): string | null {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
}

/**
 * Return a usable access token, refreshing first when the stored one is at or
 * near expiry. Hands the refreshed credential back through the session
 * callback so the caller can persist it.
 */
async function accessTokenFor(session: DestinationSession): Promise<string> {
  const { credentials } = session;
  const expiresAt = credentials.expiresAt
    ? new Date(credentials.expiresAt).getTime()
    : null;
  const stale = expiresAt !== null && expiresAt - REFRESH_SKEW_MS <= Date.now();

  if (!stale) return credentials.secret;

  if (!credentials.refreshSecret) {
    throw new Error("Gmail access has expired — reconnect the account");
  }

  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshSecret,
      client_id: id,
      client_secret: secret,
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || "Gmail access has expired — reconnect the account"
    );
  }

  const next = {
    secret: json.access_token,
    refreshSecret: json.refresh_token ?? credentials.refreshSecret,
    expiresAt: expiryFrom(json.expires_in),
  };
  credentials.secret = next.secret;
  credentials.expiresAt = next.expiresAt;
  await session.onCredentialsRefreshed?.(next);

  return next.secret;
}

async function gmailRequest<T>(args: {
  session: DestinationSession;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<T> {
  const { session, path, method = "GET", body } = args;
  const token = await accessTokenFor(session);

  const res = await fetch(`${GMAIL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      detail = json.error?.message ?? "";
    } catch {
      // ignore
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(detail || "Gmail rejected the connection — reconnect the account");
    }
    throw new Error(`Gmail request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

/**
 * Sender address: the mailbox the user connected. Never falls back to the
 * account id — that's a Google subject id, not an address.
 */
function senderFrom(session: DestinationSession): string {
  const from = session.credentials.config.email;
  if (!from) {
    throw new DestinationConfigError("Connection is missing its sender address");
  }
  return from;
}

function draftPayload(session: DestinationSession, content: DestinationContent) {
  const to = parseRecipients(content.audience);
  const raw = base64Url(
    buildMimeMessage({
      from: senderFrom(session),
      to,
      subject: content.subject?.trim() || content.title,
      html: content.html,
    })
  );
  return { message: { raw } };
}

type GmailDraft = { id?: string; message?: { id?: string; threadId?: string } };

export const gmailAdapter: ContentDestinationAdapter = {
  destination: "gmail",
  kind: "email",
  connectMethod: "oauth",
  scopes: GMAIL_SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      state,
      access_type: "offline",
      include_granted_scopes: "false",
      // Force a refresh_token even when the user has connected before.
      prompt: "consent",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "oauth") {
      throw new DestinationConfigError("Gmail connects through Google sign-in");
    }
    const { id, secret } = clientCreds();

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: id,
        client_secret: secret,
      }),
    });
    const json = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(json.error_description || `Google token exchange failed (${res.status})`);
    }

    const granted = json.scope ? json.scope.split(/\s+/).filter(Boolean) : GMAIL_SCOPES;
    if (!granted.some((s) => s.endsWith("/gmail.compose"))) {
      throw new Error(
        "Gmail permission wasn't granted — Architecta needs permission to create and send drafts"
      );
    }

    const profileRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`Could not read the Google account (${profileRes.status})`);
    }
    const profile = (await profileRes.json()) as { sub?: string; email?: string };
    if (!profile.email) {
      throw new Error("Google did not return an email address for that account");
    }

    return {
      identity: {
        // The Google subject id is stable even if the user changes their
        // address, so it's the account key; the address is the display name.
        externalAccountId: profile.sub ?? profile.email,
        externalAccountName: profile.email,
      },
      credentials: {
        secret: json.access_token,
        refreshSecret: json.refresh_token ?? null,
        expiresAt: expiryFrom(json.expires_in),
        config: { email: profile.email, googleUserId: profile.sub ?? "" },
      },
      scopes: granted,
      expiresAt: expiryFrom(json.expires_in),
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      // Listing drafts with maxResults=1 is the cheapest call the compose
      // scope allows, and proves the token is still good.
      await gmailRequest<unknown>({ session, path: "/drafts?maxResults=1" });
      return {
        ok: true,
        detail: `Connected as ${senderFrom(session)}`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : "Could not reach Gmail",
      };
    }
  },

  async createDraft(ctx: DraftContext): Promise<DraftResult> {
    const draft = await gmailRequest<GmailDraft>({
      session: ctx,
      path: "/drafts",
      method: "POST",
      body: draftPayload(ctx, ctx.content),
    });
    if (!draft.id) throw new Error("Gmail did not return a draft id");

    return {
      externalId: draft.id,
      // Deep link to the draft in the user's own Gmail UI.
      externalUrl: draft.message?.id
        ? `https://mail.google.com/mail/u/0/#drafts?compose=${draft.message.id}`
        : "https://mail.google.com/mail/u/0/#drafts",
      status: "draft",
    };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    // Sending an existing draft is the approved path; without one, create the
    // draft first so the same MIME message is what actually goes out.
    let draftId = ctx.externalId ?? null;
    if (!draftId) {
      const created = await gmailRequest<GmailDraft>({
        session: ctx,
        path: "/drafts",
        method: "POST",
        body: draftPayload(ctx, ctx.content),
      });
      draftId = created.id ?? null;
      if (!draftId) throw new Error("Gmail did not return a draft id");
    }

    const sent = await gmailRequest<{ id?: string; threadId?: string }>({
      session: ctx,
      path: "/drafts/send",
      method: "POST",
      body: { id: draftId },
    });

    return {
      externalId: sent.id ?? draftId,
      externalUrl: sent.threadId
        ? `https://mail.google.com/mail/u/0/#sent/${sent.threadId}`
        : "https://mail.google.com/mail/u/0/#sent",
      status: "sent",
    };
  },

  async schedule(): Promise<DestinationPublishResult> {
    // Gmail's "Schedule send" is a first-party UI feature with no public API.
    // Fail loudly rather than silently sending immediately.
    throw new DestinationUnsupportedError(
      "Gmail can't schedule sends through its API — send now, or use a Brevo campaign to schedule"
    );
  },

  async disconnect(session: DestinationSession): Promise<void> {
    // Revoke at Google so access ends immediately, not just locally.
    const token = session.credentials.refreshSecret || session.credentials.secret;
    if (!token) return;
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).catch(() => {
      // Local row is deleted regardless.
    });
  },
};
