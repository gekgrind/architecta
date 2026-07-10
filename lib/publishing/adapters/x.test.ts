import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { xAdapter } from "./x";

const REDIRECT = "https://architecta.example/api/connections/x/callback";

beforeEach(() => {
  process.env.X_CLIENT_ID = "x-client-123";
  process.env.X_CLIENT_SECRET = "x-secret-abc";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("xAdapter.buildAuthUrl", () => {
  it("builds a PKCE authorize URL", () => {
    const url = new URL(xAdapter.buildAuthUrl({ state: "x.nonce", redirectUri: REDIRECT }));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBe("x.nonce");
  });
});

describe("xAdapter.exchangeCode", () => {
  it("exchanges a code + verifier for tokens", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
      expect(init.headers.Authorization).toMatch(/^Basic /);
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-1", expires_in: 7200, scope: "tweet.read tweet.write" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await xAdapter.exchangeCode({ code: "abc", redirectUri: REDIRECT, state: "x.nonce" });
    expect(tokens.accessToken).toBe("tok-1");
    expect(tokens.scopes).toContain("tweet.write");
  });
});

describe("xAdapter.getAccountIdentity", () => {
  it("reads the user id + username", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "user-1", username: "misti" } }),
      }))
    );
    const id = await xAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] });
    expect(id.externalAccountId).toBe("user-1");
    expect(id.externalAccountName).toBe("misti");
  });
});

describe("xAdapter.publish", () => {
  it("posts a text-only tweet and returns its URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: "tweet-1" } }),
      }))
    );
    const result = await xAdapter.publish({
      accessToken: "tok",
      externalAccountId: "user-1",
      text: "Hello X",
    });
    expect(result.externalPostId).toBe("tweet-1");
    expect(result.externalUrl).toBe("https://x.com/i/web/status/tweet-1");
  });

  it("throws when the post fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Forbidden" }),
      }))
    );
    await expect(
      xAdapter.publish({ accessToken: "tok", externalAccountId: "user-1", text: "x" })
    ).rejects.toThrow(/Forbidden/);
  });
});
