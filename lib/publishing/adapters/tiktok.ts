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

// TikTok Content Posting API (Direct Post). video.publish requires TikTok app
// audit before posts are publicly visible — unaudited apps can only post
// content visible to the app's own test users regardless of privacy_level.
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const PUBLISH_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";

const SCOPES = ["user.info.basic", "video.publish"];

function clientCreds() {
  const key = process.env.TIKTOK_CLIENT_KEY;
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!key || !secret) {
    throw new PublishConfigError("Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET");
  }
  return { key, secret };
}

export const tiktokAdapter: PublishAdapter = {
  platform: "tiktok",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { key, secret } = clientCreds();
    const verifier = deriveCodeVerifier(state, secret);
    const params = new URLSearchParams({
      client_key: key,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
      code_challenge: codeChallengeFor(verifier),
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, state }): Promise<OAuthTokens> {
    const { key, secret } = clientCreds();
    const verifier = deriveCodeVerifier(state, secret);
    const body = new URLSearchParams({
      client_key: key,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: verifier,
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
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(
        json.error_description || json.error || `TikTok token exchange failed (${res.status})`
      );
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
    const params = new URLSearchParams({ fields: "open_id,display_name" });
    const res = await fetch(`${USER_INFO_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const json = (await res.json()) as {
      data?: { user?: { open_id?: string; display_name?: string } };
      error?: { message?: string };
    };
    const user = json.data?.user;
    if (!res.ok || !user?.open_id) {
      throw new Error(json.error?.message || `TikTok profile lookup failed (${res.status})`);
    }
    return { externalAccountId: user.open_id, externalAccountName: user.display_name ?? null };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.videoUrl && !ctx.imageUrl) {
      throw new Error("TikTok posts require a video or image");
    }

    const postInfo = {
      title: ctx.text.slice(0, 150),
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_comment: false,
    };

    const body = ctx.videoUrl
      ? {
          post_info: postInfo,
          source_info: { source: "PULL_FROM_URL", video_url: ctx.videoUrl },
          post_mode: "DIRECT_POST",
          media_type: "VIDEO",
        }
      : {
          post_info: { ...postInfo, auto_add_music: true },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 0,
            photo_images: [ctx.imageUrl],
          },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        };

    const res = await fetch(PUBLISH_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    const publishId = json.data?.publish_id;
    if (!res.ok || !publishId || (json.error && json.error.code !== "ok")) {
      throw new Error(json.error?.message || `TikTok publish failed (${res.status})`);
    }

    return {
      externalPostId: publishId,
      // TikTok doesn't return a public URL synchronously — the post is
      // processed asynchronously and only appears via the creator's profile.
      externalUrl: null,
    };
  },
};
