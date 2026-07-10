import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tiktokAdapter } from "./tiktok";

const REDIRECT = "https://architecta.example/api/connections/tiktok/callback";

beforeEach(() => {
  process.env.TIKTOK_CLIENT_KEY = "tt-key-123";
  process.env.TIKTOK_CLIENT_SECRET = "tt-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("tiktokAdapter.buildAuthUrl", () => {
  it("builds a PKCE authorize URL with client_key", () => {
    const url = new URL(tiktokAdapter.buildAuthUrl({ state: "tt.nonce", redirectUri: REDIRECT }));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("tt-key-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("tiktokAdapter.exchangeCode", () => {
  it("exchanges a code + verifier for tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-1", expires_in: 86400, scope: "user.info.basic,video.publish" }),
      }))
    );
    const tokens = await tiktokAdapter.exchangeCode({
      code: "abc",
      redirectUri: REDIRECT,
      state: "tt.nonce",
    });
    expect(tokens.accessToken).toBe("tok-1");
    expect(tokens.scopes).toContain("video.publish");
  });
});

describe("tiktokAdapter.getAccountIdentity", () => {
  it("reads open_id + display_name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { user: { open_id: "open-1", display_name: "Misti" } } }),
      }))
    );
    const id = await tiktokAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] });
    expect(id.externalAccountId).toBe("open-1");
    expect(id.externalAccountName).toBe("Misti");
  });
});

describe("tiktokAdapter.publish", () => {
  it("requires a video or image", async () => {
    await expect(
      tiktokAdapter.publish({ accessToken: "t", externalAccountId: "open-1", text: "x" })
    ).rejects.toThrow(/require a video or image/);
  });

  it("initializes a photo direct post", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      expect(body.media_type).toBe("PHOTO");
      return { ok: true, status: 200, json: async () => ({ data: { publish_id: "pub-1" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await tiktokAdapter.publish({
      accessToken: "tok",
      externalAccountId: "open-1",
      text: "Hello TikTok",
      imageUrl: "https://example.com/img.jpg",
    });
    expect(result.externalPostId).toBe("pub-1");
    expect(result.externalUrl).toBeNull();
  });

  it("initializes a video direct post when a video is present", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      expect(body.media_type).toBe("VIDEO");
      return { ok: true, status: 200, json: async () => ({ data: { publish_id: "pub-2" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await tiktokAdapter.publish({
      accessToken: "tok",
      externalAccountId: "open-1",
      text: "Hello TikTok",
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.externalPostId).toBe("pub-2");
  });
});
