import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// Meta Threads API. The OAuth dialog lives on threads.net; everything else is
// served from the graph.threads.net Graph API.
const GRAPH_VERSION = "v1.0";
const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_LIVED_URL = "https://graph.threads.net/access_token";
const ME_URL = `https://graph.threads.net/${GRAPH_VERSION}/me`;

// threads_basic for identity, threads_content_publish to post on the user's behalf.
const SCOPES = ["threads_basic", "threads_content_publish"];

function clientCreds() {
  const id = process.env.THREADS_APP_ID;
  const secret = process.env.THREADS_APP_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing THREADS_APP_ID / THREADS_APP_SECRET");
  }
  return { id, secret };
}

/** Trade the short-lived token for a ~60-day long-lived one (best-effort). */
async function exchangeForLongLived(
  shortLivedToken: string,
  secret: string
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: secret,
    access_token: shortLivedToken,
  });
  const res = await fetch(`${LONG_LIVED_URL}?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  return {
    accessToken: json.access_token,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
}

export const threadsAdapter: PublishAdapter = {
  platform: "threads",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: "code",
      // Threads expects a comma-separated scope list.
      scope: SCOPES.join(","),
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }): Promise<OAuthTokens> {
    const { id, secret } = clientCreds();
    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      access_token?: string;
      user_id?: string | number;
      error_message?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(
        json.error_message || `Threads token exchange failed (${res.status})`
      );
    }

    // Upgrade to a long-lived token so the connection survives past ~1 hour.
    const longLived = await exchangeForLongLived(json.access_token, secret);
    return {
      accessToken: longLived?.accessToken ?? json.access_token,
      refreshToken: null,
      expiresAt: longLived?.expiresAt ?? null,
      scopes: SCOPES,
    };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const params = new URLSearchParams({
      fields: "id,username",
      access_token: tokens.accessToken,
    });
    const res = await fetch(`${ME_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Threads profile lookup failed (${res.status})`);
    }
    const json = (await res.json()) as { id?: string; username?: string };
    if (!json.id) {
      throw new Error("Threads profile returned no user id");
    }
    return {
      externalAccountId: json.id,
      externalAccountName: json.username ?? null,
    };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    // Threads publishing is two steps: create a media container, then publish it.
    const createParams = new URLSearchParams({
      media_type: ctx.imageUrl ? "IMAGE" : "TEXT",
      text: ctx.text,
      access_token: ctx.accessToken,
    });
    if (ctx.imageUrl) {
      createParams.set("image_url", ctx.imageUrl);
    }

    const createRes = await fetch(
      `https://graph.threads.net/${GRAPH_VERSION}/${ctx.externalAccountId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createParams,
      }
    );
    const createJson = (await createRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !createJson.id) {
      throw new Error(
        createJson.error?.message ||
          `Threads container creation failed (${createRes.status})`
      );
    }

    const publishParams = new URLSearchParams({
      creation_id: createJson.id,
      access_token: ctx.accessToken,
    });
    const publishRes = await fetch(
      `https://graph.threads.net/${GRAPH_VERSION}/${ctx.externalAccountId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: publishParams,
      }
    );
    const publishJson = (await publishRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok || !publishJson.id) {
      throw new Error(
        publishJson.error?.message ||
          `Threads publish failed (${publishRes.status})`
      );
    }

    return {
      externalPostId: publishJson.id,
      // The public permalink needs the @username, which isn't in PublishContext;
      // leave it null rather than guess a malformed URL.
      externalUrl: null,
    };
  },
};
