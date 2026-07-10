import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// Meta Graph API. Bump as Meta deprecates versions (roughly a 2-year window).
const GRAPH_VERSION = "v25.0";
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Posting requires a Facebook Page (personal-profile posting was retired by Meta).
const SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"];

function clientCreds() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing META_APP_ID / META_APP_SECRET");
  }
  return { id, secret };
}

type FbPage = { id: string; name: string; access_token: string };

/** The stored connection token is the long-lived *user* token; Pages are looked up from it. */
async function listPages(userAccessToken: string): Promise<FbPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token",
    access_token: userAccessToken,
  });
  const res = await fetch(`${GRAPH_URL}/me/accounts?${params.toString()}`);
  const json = (await res.json()) as { data?: FbPage[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Facebook page lookup failed (${res.status})`);
  }
  return json.data ?? [];
}

export const facebookAdapter: PublishAdapter = {
  platform: "facebook",
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
        shortJson.error?.message || `Facebook token exchange failed (${shortRes.status})`
      );
    }

    // Upgrade to a long-lived (~60 day) user token; Page tokens derived from it inherit that lifetime.
    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: shortJson.access_token,
    });
    const longRes = await fetch(`${GRAPH_URL}/oauth/access_token?${longParams.toString()}`);
    const longJson = (await longRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const accessToken = longRes.ok && longJson.access_token ? longJson.access_token : shortJson.access_token;
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
      : null;

    return { accessToken, refreshToken: null, expiresAt, scopes: SCOPES };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const pages = await listPages(tokens.accessToken);
    const page = pages[0];
    if (!page) {
      throw new Error("No Facebook Page found — connect an account that manages at least one Page");
    }
    return { externalAccountId: page.id, externalAccountName: page.name };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const pages = await listPages(ctx.accessToken);
    const page = pages.find((p) => p.id === ctx.externalAccountId);
    if (!page) {
      throw new Error("Connected Facebook Page is no longer accessible with this token");
    }

    const isImage = Boolean(ctx.imageUrl);
    const endpoint = isImage ? `${GRAPH_URL}/${page.id}/photos` : `${GRAPH_URL}/${page.id}/feed`;
    const body = new URLSearchParams({ access_token: page.access_token });
    if (isImage) {
      body.set("url", ctx.imageUrl as string);
      body.set("caption", ctx.text);
    } else {
      body.set("message", ctx.text);
    }

    const res = await fetch(endpoint, { method: "POST", body });
    const json = (await res.json()) as {
      id?: string;
      post_id?: string;
      error?: { message?: string };
    };
    const postId = json.post_id || json.id;
    if (!res.ok || !postId) {
      throw new Error(json.error?.message || `Facebook post failed (${res.status})`);
    }

    return {
      externalPostId: postId,
      externalUrl: `https://www.facebook.com/${postId}`,
    };
  },
};
