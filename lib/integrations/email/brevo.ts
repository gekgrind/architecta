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

/**
 * Brevo email campaigns — the bulk counterpart to the personal mailboxes.
 *
 * Unlike Gmail and Outlook this is a plain API key, not OAuth. The key comes
 * from BREVO_API_KEY: one Brevo account serves the app, and the per-user row
 * records *which sender and account* that user is connected as. The stored
 * secret is the fallback, so a per-user key can be dropped in later without
 * touching this adapter — the env var simply wins while it is set.
 *
 * Campaigns are always created as drafts the user can open in Brevo's own
 * editor; sending is a separate, explicitly approved call.
 */

const BREVO_API = "https://api.brevo.com/v3";

/**
 * Brevo's dashboard campaign URLs aren't a documented, stable contract, so
 * link to the campaign list rather than risk a 404 on a guessed deep link.
 */
const CAMPAIGN_LIST_URL = "https://app.brevo.com/campaign/list";

function apiKeyFor(credentials: DestinationCredentials): string {
  const key = process.env.BREVO_API_KEY?.trim() || credentials.secret;
  if (!key) {
    throw new DestinationConfigError("Missing BREVO_API_KEY");
  }
  return key;
}

async function brevoRequest<T>(args: {
  apiKey: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<T | null> {
  const { apiKey, path, method = "GET", body } = args;

  const res = await fetch(`${BREVO_API}${path}`, {
    method,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as { message?: string; code?: string };
      detail = json.message ?? "";
    } catch {
      // ignore
    }
    if (res.status === 401) {
      throw new Error(detail || "Brevo rejected the API key");
    }
    throw new Error(`Brevo request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  // sendNow / status updates answer 204 with an empty body.
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

type BrevoAccount = { email?: string; companyName?: string };
type BrevoSender = { id?: number; name?: string; email?: string; active?: boolean };

function senderFrom(credentials: DestinationCredentials): { name: string; email: string } {
  const email = credentials.config.senderEmail;
  if (!email) {
    throw new DestinationConfigError("Connection is missing its sender address");
  }
  return { name: credentials.config.senderName || email, email };
}

/**
 * Brevo addresses a campaign to a *contact list*, not to individual addresses —
 * the list is built and consented to in Brevo, which is what keeps bulk sending
 * compliant. `audience` therefore carries a numeric list id.
 */
function listIdFrom(content: DestinationContent): number {
  const raw = (content.audience ?? "").trim();
  if (!raw) {
    throw new DestinationConfigError(
      "Choose a Brevo contact list to send to — campaigns go to a list, not to typed addresses"
    );
  }
  if (!/^\d+$/.test(raw)) {
    throw new DestinationConfigError(`"${raw}" isn't a Brevo list id`);
  }
  return Number(raw);
}

/** Campaign names are shown in Brevo's own list; keep them recognisable. */
function campaignName(content: DestinationContent): string {
  return content.title.slice(0, 200) || "Architecta campaign";
}

function campaignPayload(
  session: DestinationSession,
  content: DestinationContent,
  scheduledAt?: string
) {
  const payload: Record<string, unknown> = {
    name: campaignName(content),
    subject: (content.subject?.trim() || content.title).replace(/[\r\n]+/g, " ").trim(),
    sender: senderFrom(session.credentials),
    htmlContent: content.html,
    recipients: { listIds: [listIdFrom(content)] },
  };
  if (scheduledAt) payload.scheduledAt = scheduledAt;
  return payload;
}

/** Create the campaign, or update the draft this adapter already created. */
async function upsertCampaign(args: {
  apiKey: string;
  externalId: string | null | undefined;
  payload: Record<string, unknown>;
}): Promise<number> {
  const { apiKey, externalId, payload } = args;

  if (externalId) {
    await brevoRequest<null>({
      apiKey,
      path: `/emailCampaigns/${encodeURIComponent(externalId)}`,
      method: "PUT",
      body: payload,
    });
    return Number(externalId);
  }

  const created = await brevoRequest<{ id?: number }>({
    apiKey,
    path: "/emailCampaigns",
    method: "POST",
    body: payload,
  });
  if (!created?.id) throw new Error("Brevo did not return a campaign id");
  return created.id;
}

export const brevoAdapter: ContentDestinationAdapter = {
  destination: "brevo",
  kind: "email",
  connectMethod: "credentials",
  scopes: [],
  implemented: true,

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "credentials") {
      throw new DestinationConfigError("Brevo connects with an API key");
    }

    // The env key is the account Architecta sends through; a value typed into
    // the form overrides it for this user.
    const apiKey = (input.values.apiKey ?? "").trim() || process.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
      throw new DestinationConfigError(
        "No Brevo API key is configured — set BREVO_API_KEY or paste a key"
      );
    }

    const account = await brevoRequest<BrevoAccount>({ apiKey, path: "/account" });
    if (!account?.email) {
      throw new Error("Brevo did not return an account for that API key");
    }

    // A campaign must go out from a sender Brevo has verified, so resolve it
    // up front rather than failing at send time.
    const senders = await brevoRequest<{ senders?: BrevoSender[] }>({
      apiKey,
      path: "/senders",
    });
    const available = (senders?.senders ?? []).filter((s) => s.email);
    if (available.length === 0) {
      throw new Error(
        "That Brevo account has no verified sender — add one in Brevo under Senders, then reconnect"
      );
    }

    const wanted = (input.values.senderEmail ?? "").trim().toLowerCase();
    const sender = wanted
      ? available.find((s) => s.email?.toLowerCase() === wanted)
      : available.find((s) => s.active !== false) ?? available[0];
    if (!sender?.email) {
      throw new DestinationConfigError(
        `${input.values.senderEmail} isn't a verified sender on that Brevo account`
      );
    }

    return {
      identity: {
        externalAccountId: account.email,
        externalAccountName: account.companyName || account.email,
      },
      credentials: {
        secret: apiKey,
        refreshSecret: null,
        config: {
          accountEmail: account.email,
          senderEmail: sender.email,
          senderName: sender.name ?? sender.email,
        },
      },
      scopes: [],
      expiresAt: null,
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      const apiKey = apiKeyFor(session.credentials);
      const account = await brevoRequest<BrevoAccount>({ apiKey, path: "/account" });
      if (!account?.email) {
        return { ok: false, detail: "Brevo did not recognise the stored API key" };
      }
      return {
        ok: true,
        detail: `Connected as ${account.email}, sending from ${
          session.credentials.config.senderEmail ?? "an unset sender"
        }`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : "Could not reach Brevo",
      };
    }
  },

  async createDraft(ctx: DraftContext): Promise<DraftResult> {
    const apiKey = apiKeyFor(ctx.credentials);
    // No scheduledAt and no sendNow: the campaign sits in Brevo as a draft.
    const id = await upsertCampaign({
      apiKey,
      externalId: null,
      payload: campaignPayload(ctx, ctx.content),
    });

    return {
      externalId: String(id),
      externalUrl: CAMPAIGN_LIST_URL,
      status: "draft",
    };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    const apiKey = apiKeyFor(ctx.credentials);
    const id = await upsertCampaign({
      apiKey,
      externalId: ctx.externalId,
      payload: campaignPayload(ctx, ctx.content),
    });

    await brevoRequest<null>({
      apiKey,
      path: `/emailCampaigns/${id}/sendNow`,
      method: "POST",
    });

    return { externalId: String(id), externalUrl: CAMPAIGN_LIST_URL, status: "sent" };
  },

  async schedule(ctx: ScheduleDestinationContext): Promise<DestinationPublishResult> {
    const apiKey = apiKeyFor(ctx.credentials);
    const at = new Date(ctx.scheduledFor);
    if (Number.isNaN(at.getTime())) {
      throw new DestinationConfigError("Invalid scheduled time");
    }

    const id = await upsertCampaign({
      apiKey,
      externalId: ctx.externalId,
      payload: campaignPayload(ctx, ctx.content, at.toISOString()),
    });

    // scheduledAt alone only records the time; "queued" is what actually hands
    // the campaign to Brevo's scheduler.
    await brevoRequest<null>({
      apiKey,
      path: `/emailCampaigns/${id}/status`,
      method: "PUT",
      body: { status: "queued" },
    });

    return { externalId: String(id), externalUrl: CAMPAIGN_LIST_URL, status: "scheduled" };
  },

  async disconnect(): Promise<void> {
    // API keys are revoked by the account owner in Brevo (SMTP & API → API
    // keys). Nothing to call remotely; the stored row is deleted by the caller.
  },
};

/** Contact lists for the send form — Brevo campaigns address a list, not addresses. */
export async function listBrevoLists(
  credentials: DestinationCredentials
): Promise<Array<{ id: number; name: string }>> {
  const apiKey = apiKeyFor(credentials);
  const res = await brevoRequest<{ lists?: Array<{ id?: number; name?: string }> }>({
    apiKey,
    path: "/contacts/lists?limit=50&offset=0",
  });
  return (res?.lists ?? [])
    .filter((l): l is { id: number; name: string } => typeof l.id === "number")
    .map((l) => ({ id: l.id, name: l.name ?? `List ${l.id}` }));
}
