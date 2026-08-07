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
 * The user's own Outlook / Microsoft 365 mailbox, over Microsoft Graph.
 *
 * SCOPES — deliberately narrow, and never broader than the mailbox:
 *   openid, email      identify which account is connected, so the user can
 *                      see (and we can address) the right mailbox.
 *   offline_access     issue a refresh token; without it the connection dies
 *                      in an hour and the user has to reconnect constantly.
 *   Mail.ReadWrite     create and update drafts. Graph has no draft-only
 *                      scope — createMessage requires ReadWrite.
 *   Mail.Send          send the draft the user approved.
 *
 * Explicitly NOT requested: Mail.Read.Shared, Mail.ReadWrite.Shared,
 * User.Read.All, or any *.All application permission.
 */
export const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
];

const GRAPH_API = "https://graph.microsoft.com/v1.0";
// Works with openid/email alone, so identity costs no extra scope.
const USERINFO_URL = "https://graph.microsoft.com/oidc/userinfo";

/** Refresh this far ahead of expiry so a slow request can't race the clock. */
const REFRESH_SKEW_MS = 60_000;

/**
 * "common" lets both work and personal Microsoft accounts connect. An operator
 * who registered a single-tenant app sets MICROSOFT_TENANT_ID to its tenant id.
 */
function tenant(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

function authorizeUrl(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`;
}

function tokenUrl(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`;
}

function clientCreds() {
  const id = process.env.MICROSOFT_CLIENT_ID;
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new DestinationConfigError(
      "Missing MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET"
    );
  }
  return { id, secret };
}

/**
 * Exchange 365 sends to a *personal mailbox* is throttled (Microsoft's limit is
 * 500 recipients per message, 10,000 recipients a day); the cap here keeps a
 * mailbox well clear of it and pushes real campaigns to Brevo.
 */
export function parseOutlookRecipients(raw: string | null | undefined): string[] {
  return parseRecipientList(raw, {
    max: 100,
    overflowMessage:
      "Outlook is for single and small-group sends — use a Brevo campaign for larger audiences",
  });
}

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
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
    throw new Error("Outlook access has expired — reconnect the account");
  }

  const { id, secret } = clientCreds();
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshSecret,
      client_id: id,
      client_secret: secret,
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });
  const json = (await res.json()) as MicrosoftTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || "Outlook access has expired — reconnect the account"
    );
  }

  const next = {
    secret: json.access_token,
    // Microsoft rotates refresh tokens on every use — always keep the new one.
    refreshSecret: json.refresh_token ?? credentials.refreshSecret,
    expiresAt: expiryFrom(json.expires_in),
  };
  credentials.secret = next.secret;
  credentials.refreshSecret = next.refreshSecret;
  credentials.expiresAt = next.expiresAt;
  await session.onCredentialsRefreshed?.(next);

  return next.secret;
}

async function graphRequest<T>(args: {
  session: DestinationSession;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<T | null> {
  const { session, path, method = "GET", body } = args;
  const token = await accessTokenFor(session);

  const res = await fetch(`${GRAPH_API}${path}`, {
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
      throw new Error(
        detail || "Outlook rejected the connection — reconnect the account"
      );
    }
    throw new Error(
      `Microsoft Graph request failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  // sendMail / send answer 202 Accepted with an empty body.
  if (res.status === 204 || res.status === 202) return null;
  return (await res.json()) as T;
}

/**
 * Sender address: the mailbox the user connected. Graph always sends as the
 * authenticated mailbox, so this is for display and validation, not a header.
 */
function senderFrom(session: DestinationSession): string {
  const from = session.credentials.config.email;
  if (!from) {
    throw new DestinationConfigError("Connection is missing its sender address");
  }
  return from;
}

/** Strip CR/LF so a crafted subject can't inject anything downstream. */
function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function messagePayload(content: DestinationContent) {
  const to = parseOutlookRecipients(content.audience);
  return {
    subject: sanitizeSubject(content.subject?.trim() || content.title),
    body: { contentType: "HTML", content: content.html },
    toRecipients: to.map((address) => ({ emailAddress: { address } })),
  };
}

type GraphMessage = { id?: string; webLink?: string };

export const microsoftAdapter: ContentDestinationAdapter = {
  destination: "microsoft",
  kind: "email",
  connectMethod: "oauth",
  scopes: MICROSOFT_SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: MICROSOFT_SCOPES.join(" "),
      state,
      // Force the consent screen so a reconnect always yields a refresh token.
      prompt: "consent",
    });
    return `${authorizeUrl()}?${params.toString()}`;
  },

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "oauth") {
      throw new DestinationConfigError("Outlook connects through Microsoft sign-in");
    }
    const { id, secret } = clientCreds();

    const res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: id,
        client_secret: secret,
        scope: MICROSOFT_SCOPES.join(" "),
      }),
    });
    const json = (await res.json()) as MicrosoftTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(
        json.error_description || `Microsoft token exchange failed (${res.status})`
      );
    }

    const granted = json.scope ? json.scope.split(/\s+/).filter(Boolean) : MICROSOFT_SCOPES;
    // Graph returns scopes unprefixed ("Mail.Send"), so match on the suffix.
    const hasScope = (name: string) =>
      granted.some((s) => s === name || s.endsWith(`/${name}`));
    if (!hasScope("Mail.Send") || !hasScope("Mail.ReadWrite")) {
      throw new Error(
        "Mail permission wasn't granted — Architecta needs permission to create and send drafts"
      );
    }

    const profileRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`Could not read the Microsoft account (${profileRes.status})`);
    }
    const profile = (await profileRes.json()) as { sub?: string; email?: string };
    if (!profile.email) {
      throw new Error("Microsoft did not return an email address for that account");
    }

    return {
      identity: {
        externalAccountId: profile.sub ?? profile.email,
        externalAccountName: profile.email,
      },
      credentials: {
        secret: json.access_token,
        refreshSecret: json.refresh_token ?? null,
        expiresAt: expiryFrom(json.expires_in),
        config: { email: profile.email, microsoftUserId: profile.sub ?? "" },
      },
      scopes: granted,
      expiresAt: expiryFrom(json.expires_in),
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      // Reading the drafts folder is the cheapest call Mail.ReadWrite allows,
      // and proves the token is still good.
      await graphRequest<unknown>({
        session,
        path: "/me/mailFolders/drafts?$select=id",
      });
      return { ok: true, detail: `Connected as ${senderFrom(session)}` };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : "Could not reach Outlook",
      };
    }
  },

  async createDraft(ctx: DraftContext): Promise<DraftResult> {
    const draft = await graphRequest<GraphMessage>({
      session: ctx,
      path: "/me/messages",
      method: "POST",
      body: messagePayload(ctx.content),
    });
    if (!draft?.id) throw new Error("Microsoft Graph did not return a draft id");

    return {
      externalId: draft.id,
      // Deep link into the user's own Outlook web client.
      externalUrl: draft.webLink ?? "https://outlook.office.com/mail/drafts",
      status: "draft",
    };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    // Sending an existing draft is the approved path; without one, create the
    // draft first so the same message is what actually goes out.
    let draftId = ctx.externalId ?? null;
    let webLink: string | null = null;
    if (!draftId) {
      const created = await graphRequest<GraphMessage>({
        session: ctx,
        path: "/me/messages",
        method: "POST",
        body: messagePayload(ctx.content),
      });
      draftId = created?.id ?? null;
      webLink = created?.webLink ?? null;
      if (!draftId) throw new Error("Microsoft Graph did not return a draft id");
    }

    // 202 Accepted, empty body — Graph moves the message to Sent Items itself.
    await graphRequest<null>({
      session: ctx,
      path: `/me/messages/${encodeURIComponent(draftId)}/send`,
      method: "POST",
    });

    return {
      externalId: draftId,
      externalUrl: webLink ?? "https://outlook.office.com/mail/sentitems",
      status: "sent",
    };
  },

  async schedule(): Promise<DestinationPublishResult> {
    // Outlook's "Delay delivery" is an Exchange MAPI property, not a supported
    // Graph field. Fail loudly rather than silently sending immediately.
    throw new DestinationUnsupportedError(
      "Outlook can't schedule sends through Microsoft Graph — send now, or use a Brevo campaign to schedule"
    );
  },

  async disconnect(): Promise<void> {
    // Microsoft has no per-application token revocation endpoint; users revoke
    // access at https://myapps.microsoft.com. The stored row is deleted by the
    // caller either way, and the refresh token dies with it.
  },
};
