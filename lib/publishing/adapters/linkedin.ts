import "server-only";

import {
  PublishConfigError,
  type AccountIdentity,
  type OAuthTokens,
  type PublishAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

// LinkedIn versioned REST API. Bump as LinkedIn deprecates versions.
// (202405 was retired by LinkedIn — it returns 426 NONEXISTENT_VERSION.)
const LINKEDIN_VERSION = "202605";
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGES_URL = "https://api.linkedin.com/rest/images?action=initializeUpload";

// Personal-profile posting: OpenID Connect for identity + w_member_social to post.
const SCOPES = ["openid", "profile", "w_member_social"];

function clientCreds() {
  const id = process.env.LINKEDIN_CLIENT_ID;
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PublishConfigError("Missing LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET");
  }
  return { id, secret };
}

function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function uploadImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string
): Promise<string> {
  // 1) Initialize an upload, get the target URL + image URN.
  const initRes = await fetch(IMAGES_URL, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!initRes.ok) {
    throw new Error(`LinkedIn image init failed (${initRes.status})`);
  }
  const initJson = (await initRes.json()) as {
    value?: { uploadUrl?: string; image?: string };
  };
  const uploadUrl = initJson.value?.uploadUrl;
  const imageUrn = initJson.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image init returned no upload target");
  }

  // 2) Fetch the asset bytes (Supabase signed URL) and PUT them to LinkedIn.
  const assetRes = await fetch(imageUrl);
  if (!assetRes.ok) {
    throw new Error(`Could not fetch image asset (${assetRes.status})`);
  }
  const bytes = new Uint8Array(await assetRes.arrayBuffer());
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`LinkedIn image upload failed (${putRes.status})`);
  }
  return imageUrn;
}

export const linkedinAdapter: PublishAdapter = {
  platform: "linkedin",
  scopes: SCOPES,
  implemented: true,

  buildAuthUrl({ state, redirectUri }) {
    const { id } = clientCreds();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: id,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES.join(" "),
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
      throw new Error(json.error_description || `LinkedIn token exchange failed (${res.status})`);
    }
    const expiresAt = json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt,
      scopes: json.scope ? json.scope.split(/[\s,]+/).filter(Boolean) : SCOPES,
    };
  },

  async getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`LinkedIn userinfo failed (${res.status})`);
    }
    const json = (await res.json()) as { sub?: string; name?: string };
    if (!json.sub) {
      throw new Error("LinkedIn userinfo returned no subject id");
    }
    return {
      externalAccountId: json.sub,
      externalAccountName: json.name ?? null,
    };
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const authorUrn = `urn:li:person:${ctx.externalAccountId}`;

    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: ctx.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (ctx.imageUrl) {
      try {
        const imageUrn = await uploadImage(ctx.accessToken, authorUrn, ctx.imageUrl);
        body.content = { media: { id: imageUrn, altText: "" } };
      } catch {
        // Image attach is best-effort — fall back to a text-only post.
      }
    }

    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: restHeaders(ctx.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        // ignore
      }
      throw new Error(`LinkedIn post failed (${res.status})${detail ? `: ${detail}` : ""}`);
    }

    // The created post URN comes back in a response header.
    const urn =
      res.headers.get("x-restli-id") ||
      res.headers.get("x-linkedin-id") ||
      null;
    return {
      externalPostId: urn ?? "",
      externalUrl: urn ? `https://www.linkedin.com/feed/update/${urn}` : null,
    };
  },
};
