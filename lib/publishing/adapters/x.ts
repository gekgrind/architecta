import "server-only";

import { codeChallengeFor, deriveCodeVerifier } from "../pkce";
import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// X (Twitter) API v2. The x.com OAuth domain replaced twitter.com in April 2026
// (twitter.com/i/oauth2/authorize now 404s) — do not revert this.
const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";
const TWEETS_URL = "https://api.x.com/2/tweets";
const MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];

function clientCreds() {
  const id = process.env.X_CLIENT_ID;
  const secret = process.env.X_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing X_CLIENT_ID / X_CLIENT_SECRET");
  }
  return { id, secret };
}

function basicAuthHeader(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/** Upload an image via the single-chunk INIT/APPEND/FINALIZE flow and return its media_id. */
async function uploadImage(accessToken: string, imageUrl: string): Promise<string> {
  const assetRes = await fetch(imageUrl);
  if (!assetRes.ok) {
    throw new Error(`Could not fetch image asset (${assetRes.status})`);
  }
  const mediaType = assetRes.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await assetRes.arrayBuffer());
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const initForm = new FormData();
  initForm.set("command", "INIT");
  initForm.set("media_type", mediaType);
  initForm.set("total_bytes", String(bytes.byteLength));
  initForm.set("media_category", "tweet_image");
  const initRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: authHeader,
    body: initForm,
  });
  const initJson = (await initRes.json()) as {
    data?: { id?: string };
    errors?: { message?: string }[];
  };
  const mediaId = initJson.data?.id;
  if (!initRes.ok || !mediaId) {
    throw new Error(
      initJson.errors?.[0]?.message || `X media init failed (${initRes.status})`
    );
  }

  const appendForm = new FormData();
  appendForm.set("command", "APPEND");
  appendForm.set("media_id", mediaId);
  appendForm.set("segment_index", "0");
  appendForm.set("media", new Blob([bytes], { type: mediaType }), "asset");
  const appendRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: authHeader,
    body: appendForm,
  });
  if (!appendRes.ok) {
    throw new Error(`X media append failed (${appendRes.status})`);
  }

  const finalizeForm = new FormData();
  finalizeForm.set("command", "FINALIZE");
  finalizeForm.set("media_id", mediaId);
  const finalizeRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: authHeader,
    body: finalizeForm,
  });
  if (!finalizeRes.ok) {
    throw new Error(`X media finalize failed (${finalizeRes.status})`);
  }

  return mediaId;
}

export const xAdapter: PublishAdapter = {
  platform: "x",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id, secret } = clientCreds();
    const verifier = deriveCodeVerifier(state, secret);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: id,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      code_challenge: codeChallengeFor(verifier),
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, state }): Promise<OAuthTokens> {
    const { id, secret } = clientCreds();
    const verifier = deriveCodeVerifier(state, secret);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      client_id: id,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(id, secret),
      },
      body,
    });
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error_description || `X token exchange failed (${res.status})`);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
      scopes: json.scope ? json.scope.split(/\s+/).filter(Boolean) : SCOPES,
    };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const res = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const json = (await res.json()) as {
      data?: { id?: string; username?: string };
      errors?: { message?: string }[];
    };
    if (!res.ok || !json.data?.id) {
      throw new Error(json.errors?.[0]?.message || `X profile lookup failed (${res.status})`);
    }
    return {
      externalAccountId: json.data.id,
      externalAccountName: json.data.username ?? null,
    };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const body: Record<string, unknown> = { text: ctx.text };

    if (ctx.imageUrl) {
      try {
        const mediaId = await uploadImage(ctx.accessToken, ctx.imageUrl);
        body.media = { media_ids: [mediaId] };
      } catch {
        // Image attach is best-effort — fall back to a text-only post.
      }
    }

    const res = await fetch(TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      data?: { id?: string };
      errors?: { message?: string }[];
      title?: string;
      detail?: string;
    };
    const id = json.data?.id;
    if (!res.ok || !id) {
      throw new Error(
        json.errors?.[0]?.message || json.detail || `X post failed (${res.status})`
      );
    }

    return {
      externalPostId: id,
      externalUrl: `https://x.com/i/web/status/${id}`,
    };
  },
};
