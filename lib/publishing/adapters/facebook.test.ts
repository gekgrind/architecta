import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { facebookAdapter } from "./facebook";

const REDIRECT = "https://architecta.example/api/connections/facebook/callback";

beforeEach(() => {
  process.env.META_APP_ID = "meta-123";
  process.env.META_APP_SECRET = "meta-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("facebookAdapter.buildAuthUrl", () => {
  it("builds a valid authorize URL with scope + state", () => {
    const url = new URL(
      facebookAdapter.buildAuthUrl({ state: "facebook.nonce", redirectUri: REDIRECT })
    );
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("meta-123");
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
    expect(url.searchParams.get("state")).toBe("facebook.nonce");
  });
});

describe("facebookAdapter.exchangeCode", () => {
  it("exchanges a code and upgrades to a long-lived token", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fb_exchange_token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: "long-lived", expires_in: 5184000 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "short-lived" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await facebookAdapter.exchangeCode({
      code: "abc",
      redirectUri: REDIRECT,
      state: "facebook.nonce",
    });
    expect(tokens.accessToken).toBe("long-lived");
    expect(tokens.expiresAt).toBeTruthy();
  });

  it("throws when the short-lived exchange fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad code" } }),
      }))
    );
    await expect(
      facebookAdapter.exchangeCode({ code: "bad", redirectUri: REDIRECT, state: "s" })
    ).rejects.toThrow(/bad code/);
  });
});

describe("facebookAdapter.getAccountIdentity", () => {
  it("returns the first managed Page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "page-1", name: "My Page", access_token: "page-token" }],
        }),
      }))
    );
    const id = await facebookAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] });
    expect(id.externalAccountId).toBe("page-1");
    expect(id.externalAccountName).toBe("My Page");
  });

  it("throws when the user manages no Pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }))
    );
    await expect(
      facebookAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] })
    ).rejects.toThrow(/No Facebook Page/);
  });
});

describe("facebookAdapter.publish", () => {
  it("posts text to the page feed using the page access token", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/me/accounts")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: "page-1", name: "My Page", access_token: "page-token" }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ id: "111_222" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await facebookAdapter.publish({
      accessToken: "user-tok",
      externalAccountId: "page-1",
      text: "Hello Facebook",
    });
    expect(result.externalPostId).toBe("111_222");
    expect(result.externalUrl).toContain("111_222");
  });

  it("throws when the connected Page is no longer accessible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }))
    );
    await expect(
      facebookAdapter.publish({ accessToken: "t", externalAccountId: "page-1", text: "x" })
    ).rejects.toThrow(/no longer accessible/);
  });
});
