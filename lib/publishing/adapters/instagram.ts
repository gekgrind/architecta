import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// Instagram posting rides on the Meta Graph API through a Facebook Page that
// has an Instagram professional (Business/Creator) account connected to it.
const GRAPH_VERSION = "v25.0";
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
];

function clientCreds() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing META_APP_ID / META_APP_SECRET");
  }
  return { id, secret };
}

type IgPage = {
  id: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

/** The stored connection token is the long-lived *user* token; the linked IG account is looked up from it. */
async function listPagesWithInstagram(userAccessToken: string): Promise<IgPage[]> {
  const params = new URLSearchParams({
    fields: "id,access_token,instagram_business_account{id,username}",
    access_token: userAccessToken,
  });
  const res = await fetch(`${GRAPH_URL}/me/accounts?${params.toString()}`);
  const json = (await res.json()) as { data?: IgPage[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Instagram account lookup failed (${res.status})`);
  }
  return json.data ?? [];
}

export const instagramAdapter: PublishAdapter = {
  platform: "instagram",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES.join(","),
      response_type: "code",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }): Promise<OAuthTokens> {
    const { id, secret } = clientCreds();
    const shortLivedParams = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch(`${GRAPH_URL}/oauth/access_token?${shortLivedParams.toString()}`);
    const shortJson = (await shortRes.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(
        shortJson.error?.message || `Instagram token exchange failed (${shortRes.status})`
      );
    }

    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: shortJson.access_token,
    });
    const longRes = await fetch(`${GRAPH_URL}/oauth/access_token?${longParams.toString()}`);
    const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number };
    const accessToken = longRes.ok && longJson.access_token ? longJson.access_token : shortJson.access_token;
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
      : null;

    return { accessToken, refreshToken: null, expiresAt, scopes: SCOPES };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const pages = await listPagesWithInstagram(tokens.accessToken);
    const linked = pages.find((p) => p.instagram_business_account)?.instagram_business_account;
    if (!linked) {
      throw new Error(
        "No Instagram professional account found — connect a Facebook Page with a linked Instagram Business or Creator account"
      );
    }
    return { externalAccountId: linked.id, externalAccountName: linked.username ?? null };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.imageUrl) {
      throw new Error("Instagram posts require an image");
    }

    const pages = await listPagesWithInstagram(ctx.accessToken);
    const page = pages.find((p) => p.instagram_business_account?.id === ctx.externalAccountId);
    if (!page) {
      throw new Error("Connected Instagram account is no longer accessible with this token");
    }
    const pageAccessToken = page.access_token;

    // 1) Create a media container.
    const createParams = new URLSearchParams({
      image_url: ctx.imageUrl,
      caption: ctx.text,
      access_token: pageAccessToken,
    });
    const createRes = await fetch(`${GRAPH_URL}/${ctx.externalAccountId}/media`, {
      method: "POST",
      body: createParams,
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) {
      throw new Error(
        createJson.error?.message || `Instagram container creation failed (${createRes.status})`
      );
    }

    // 2) Publish the container.
    const publishParams = new URLSearchParams({
      creation_id: createJson.id,
      access_token: pageAccessToken,
    });
    const publishRes = await fetch(`${GRAPH_URL}/${ctx.externalAccountId}/media_publish`, {
      method: "POST",
      body: publishParams,
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || !publishJson.id) {
      throw new Error(
        publishJson.error?.message || `Instagram publish failed (${publishRes.status})`
      );
    }

    // 3) Best-effort permalink lookup.
    let externalUrl: string | null = null;
    try {
      const permalinkParams = new URLSearchParams({
        fields: "permalink",
        access_token: pageAccessToken,
      });
      const permalinkRes = await fetch(
        `${GRAPH_URL}/${publishJson.id}?${permalinkParams.toString()}`
      );
      if (permalinkRes.ok) {
        const permalinkJson = (await permalinkRes.json()) as { permalink?: string };
        externalUrl = permalinkJson.permalink ?? null;
      }
    } catch {
      // Permalink is a nice-to-have — ignore failures.
    }

    return { externalPostId: publishJson.id, externalUrl };
  },
};
