import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

const AUTH_URL = "https://www.pinterest.com/oauth/";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const API_URL = "https://api.pinterest.com/v5";

const SCOPES = ["boards:read", "pins:read", "pins:write", "user_accounts:read"];

function clientCreds() {
  const id = process.env.PINTEREST_APP_ID;
  const secret = process.env.PINTEREST_APP_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing PINTEREST_APP_ID / PINTEREST_APP_SECRET");
  }
  return { id, secret };
}

function basicAuthHeader(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function firstBoardId(accessToken: string): Promise<string> {
  const res = await fetch(`${API_URL}/boards?page_size=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    items?: { id?: string }[];
    message?: string;
  };
  const boardId = json.items?.[0]?.id;
  if (!res.ok || !boardId) {
    throw new Error(json.message || "No Pinterest board found — create a board to publish pins");
  }
  return boardId;
}

export const pinterestAdapter: PublishAdapter = {
  platform: "pinterest",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }): Promise<OAuthTokens> {
    const { id, secret } = clientCreds();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
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
      message?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(json.message || `Pinterest token exchange failed (${res.status})`);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
      scopes: json.scope ? json.scope.split(/[\s,]+/).filter(Boolean) : SCOPES,
    };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const res = await fetch(`${API_URL}/user_account`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const json = (await res.json()) as { username?: string; message?: string };
    if (!res.ok || !json.username) {
      throw new Error(json.message || `Pinterest profile lookup failed (${res.status})`);
    }
    return { externalAccountId: json.username, externalAccountName: json.username };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.imageUrl) {
      throw new Error("Pinterest pins require an image");
    }

    const boardId = await firstBoardId(ctx.accessToken);
    const res = await fetch(`${API_URL}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: boardId,
        title: ctx.text.slice(0, 100),
        description: ctx.text.slice(0, 800),
        media_source: { source_type: "image_url", url: ctx.imageUrl },
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !json.id) {
      throw new Error(json.message || `Pinterest pin creation failed (${res.status})`);
    }

    return {
      externalPostId: json.id,
      externalUrl: `https://www.pinterest.com/pin/${json.id}/`,
    };
  },
};
