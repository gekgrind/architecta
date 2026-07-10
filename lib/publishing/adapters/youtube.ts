import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// Google OAuth2 + YouTube Data API v3. Reuses the same Google Cloud project as
// Google sign-in (GOOGLE_CLIENT_ID/SECRET) — just needs the YouTube Data API
// enabled and these scopes added to the OAuth consent screen.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  return { id, secret };
}

function titleFrom(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0);
  return (firstLine ?? "New video").slice(0, 100);
}

export const youtubeAdapter: PublishAdapter = {
  platform: "youtube",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
      access_type: "offline",
      // Force a refresh_token even on re-connect.
      prompt: "consent",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }): Promise<OAuthTokens> {
    const { id, secret } = clientCreds();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: id,
      client_secret: secret,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      throw new Error(json.error_description || `YouTube token exchange failed (${res.status})`);
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
    const params = new URLSearchParams({ part: "snippet", mine: "true" });
    const res = await fetch(`${CHANNELS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const json = (await res.json()) as {
      items?: { id?: string; snippet?: { title?: string } }[];
      error?: { message?: string };
    };
    const channel = json.items?.[0];
    if (!res.ok || !channel?.id) {
      throw new Error(json.error?.message || `YouTube channel lookup failed (${res.status})`);
    }
    return {
      externalAccountId: channel.id,
      externalAccountName: channel.snippet?.title ?? null,
    };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.videoUrl) {
      throw new Error("YouTube requires a video");
    }

    const assetRes = await fetch(ctx.videoUrl);
    if (!assetRes.ok) {
      throw new Error(`Could not fetch video asset (${assetRes.status})`);
    }
    const contentType = assetRes.headers.get("content-type") || "video/mp4";
    const bytes = new Uint8Array(await assetRes.arrayBuffer());

    // 1) Start a resumable upload session.
    const startRes = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(bytes.byteLength),
      },
      body: JSON.stringify({
        snippet: { title: titleFrom(ctx.text), description: ctx.text },
        // Unaudited API clients are restricted to private uploads by YouTube.
        status: { privacyStatus: "public" },
      }),
    });
    const uploadSessionUrl = startRes.headers.get("location");
    if (!startRes.ok || !uploadSessionUrl) {
      const err = (await startRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err.error?.message || `YouTube upload init failed (${startRes.status})`);
    }

    // 2) Upload the video bytes to the session URL.
    const uploadRes = await fetch(uploadSessionUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    const uploadJson = (await uploadRes.json()) as { id?: string; error?: { message?: string } };
    if (!uploadRes.ok || !uploadJson.id) {
      throw new Error(uploadJson.error?.message || `YouTube upload failed (${uploadRes.status})`);
    }

    return {
      externalPostId: uploadJson.id,
      externalUrl: `https://www.youtube.com/watch?v=${uploadJson.id}`,
    };
  },
};
