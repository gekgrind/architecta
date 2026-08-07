import "server-only";

import {
  DestinationConfigError,
  type ConnectionCheck,
  type ContentDestinationAdapter,
  type DestinationConnectInput,
  type DestinationConnection,
  type DestinationContent,
  type DestinationCredentials,
  type DestinationPublishResult,
  type DestinationSession,
  type DraftContext,
  type DraftResult,
  type PublishDestinationContext,
  type ScheduleDestinationContext,
} from "../types";
import { normalizePublicHttpsUrl } from "../url";

/**
 * A custom site: any endpoint the user controls that accepts a JSON POST.
 *
 * This is the escape hatch for blogs that aren't WordPress or Ghost. Every
 * value is stored per user — their own webhook URL, their own header name, and
 * their own credential — so two users on the same plan post to two different
 * sites. Nothing here reads app-level config.
 *
 * The request Architecta sends:
 *
 *   POST <webhookUrl>
 *   Content-Type: application/json
 *   <authHeader>: <the stored credential>
 *
 *   {
 *     "action": "draft" | "publish" | "schedule" | "connection.test",
 *     "scheduledFor": "2026-01-01T09:00:00.000Z",   // schedule only
 *     "post": { "title", "html", "text", "slug", "categories", "tags",
 *               "featuredImageUrl", "subject" }
 *   }
 *
 * Any 2xx counts as success. If the response is JSON carrying `id` and/or
 * `url` (at the top level or under `data`), they're recorded so the post can
 * be promoted from draft to published later; otherwise the action still
 * succeeds, it just isn't linkable.
 */

/** Header the credential rides in when the user doesn't name one. */
const DEFAULT_AUTH_HEADER = "Authorization";

/** A webhook that hasn't answered in this long isn't going to. */
const REQUEST_TIMEOUT_MS = 20_000;

export function normalizeWebhookUrl(raw: string): string {
  const url = normalizePublicHttpsUrl(raw, {
    invalid:
      "Enter the full webhook URL, including https:// — for example https://example.com/api/posts",
    insecure: "The webhook URL must use https:// — your credential is sent with every request.",
    private: "That host isn't a reachable public endpoint.",
  });
  return url.toString();
}

/**
 * Header names are written straight into an outbound request, so restrict them
 * to the RFC 7230 token charset — anything else could inject a second header.
 */
export function normalizeHeaderName(raw: string | undefined): string {
  const name = (raw ?? "").trim() || DEFAULT_AUTH_HEADER;
  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) {
    throw new DestinationConfigError(
      `"${name}" isn't a valid header name — use something like Authorization or X-API-Key`
    );
  }
  return name;
}

function endpointFrom(credentials: DestinationCredentials): string {
  const url = credentials.config.webhookUrl;
  if (!url) throw new DestinationConfigError("Connection is missing its webhook URL");
  return normalizeWebhookUrl(url);
}

type WebhookAck = {
  id?: string | number;
  url?: string;
  data?: { id?: string | number; url?: string };
  message?: string;
  error?: string;
};

async function postToWebhook(args: {
  credentials: DestinationCredentials;
  payload: Record<string, unknown>;
}): Promise<WebhookAck> {
  const { credentials, payload } = args;
  const url = endpointFrom(credentials);
  const headerName = normalizeHeaderName(credentials.config.authHeader);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [headerName]: credentials.secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Your endpoint didn't respond in time");
    }
    throw new Error(
      `Could not reach ${new URL(url).host}${err instanceof Error ? `: ${err.message}` : ""}`
    );
  }

  // Read once: the body doubles as the error detail and the success ack.
  const raw = await res.text();
  let json: WebhookAck | null = null;
  try {
    json = raw ? (JSON.parse(raw) as WebhookAck) : null;
  } catch {
    // A non-JSON body is fine on success and useful context on failure.
  }

  if (!res.ok) {
    const detail = json?.error || json?.message || raw.slice(0, 200).trim();
    if (res.status === 401 || res.status === 403) {
      throw new Error(detail || "Your endpoint rejected the credential");
    }
    if (res.status === 404) {
      throw new Error(detail || "Your endpoint returned 404 — check the webhook URL");
    }
    throw new Error(
      `Your endpoint returned ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  return json ?? {};
}

function postPayload(content: DestinationContent) {
  return {
    title: content.title,
    html: content.html,
    text: content.text ?? null,
    slug: content.slug ?? null,
    categories: content.categories ?? [],
    tags: content.tags ?? [],
    featuredImageUrl: content.featuredImageUrl ?? null,
    subject: content.subject ?? null,
  };
}

/** Pull the id/url out of whichever shape the endpoint answered with. */
function ackToResult(ack: WebhookAck): { externalId: string; externalUrl: string | null } {
  const id = ack.id ?? ack.data?.id;
  const url = ack.url ?? ack.data?.url ?? null;
  return { externalId: id === undefined || id === null ? "" : String(id), externalUrl: url };
}

export const customAdapter: ContentDestinationAdapter = {
  destination: "custom",
  kind: "cms",
  connectMethod: "credentials",
  scopes: [],
  implemented: true,

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "credentials") {
      throw new DestinationConfigError(
        "A custom site connects with a webhook URL and credential"
      );
    }
    const webhookUrl = normalizeWebhookUrl(input.values.webhookUrl ?? "");
    const authHeader = normalizeHeaderName(input.values.authHeader);
    const authValue = (input.values.authValue ?? "").trim();
    if (!authValue) {
      throw new DestinationConfigError(
        "The credential is required — it's what proves the request came from Architecta"
      );
    }

    const credentials: DestinationCredentials = {
      secret: authValue,
      refreshSecret: null,
      config: { webhookUrl, authHeader },
    };

    // Prove the endpoint is reachable and the credential is accepted before
    // saving it — a connection that only fails at publish time is worse than
    // one that never connects.
    await postToWebhook({
      credentials,
      payload: { action: "connection.test" },
    });

    const host = new URL(webhookUrl).host;
    return {
      identity: { externalAccountId: webhookUrl, externalAccountName: host },
      credentials,
      scopes: [],
      expiresAt: null,
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      await postToWebhook({
        credentials: session.credentials,
        payload: { action: "connection.test" },
      });
      return {
        ok: true,
        detail: `Connected to ${new URL(endpointFrom(session.credentials)).host}`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : "Could not reach your endpoint",
      };
    }
  },

  async createDraft(ctx: DraftContext): Promise<DraftResult> {
    const ack = await postToWebhook({
      credentials: ctx.credentials,
      payload: { action: "draft", post: postPayload(ctx.content) },
    });
    return { ...ackToResult(ack), status: "draft" };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    const ack = await postToWebhook({
      credentials: ctx.credentials,
      payload: {
        action: "publish",
        // Present when promoting a draft this endpoint already acknowledged.
        externalId: ctx.externalId ?? null,
        post: postPayload(ctx.content),
      },
    });
    const result = ackToResult(ack);
    return {
      externalId: result.externalId || (ctx.externalId ?? ""),
      externalUrl: result.externalUrl,
      status: "published",
    };
  },

  async schedule(ctx: ScheduleDestinationContext): Promise<DestinationPublishResult> {
    const at = new Date(ctx.scheduledFor);
    if (Number.isNaN(at.getTime())) {
      throw new DestinationConfigError("Invalid scheduled time");
    }

    const ack = await postToWebhook({
      credentials: ctx.credentials,
      payload: {
        action: "schedule",
        externalId: ctx.externalId ?? null,
        scheduledFor: at.toISOString(),
        post: postPayload(ctx.content),
      },
    });
    const result = ackToResult(ack);
    return {
      externalId: result.externalId || (ctx.externalId ?? ""),
      externalUrl: result.externalUrl,
      status: "scheduled",
    };
  },

  async disconnect(): Promise<void> {
    // The endpoint is the user's own; there's nothing to revoke remotely.
    // The stored row (URL + credential) is deleted by the caller.
  },
};
