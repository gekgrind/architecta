import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pinterestAdapter } from "./pinterest";

const REDIRECT = "https://architecta.example/api/connections/pinterest/callback";

beforeEach(() => {
  process.env.PINTEREST_APP_ID = "pin-123";
  process.env.PINTEREST_APP_SECRET = "pin-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pinterestAdapter.buildAuthUrl", () => {
  it("builds a valid authorize URL", () => {
    const url = new URL(
      pinterestAdapter.buildAuthUrl({ state: "pin.nonce", redirectUri: REDIRECT })
    );
    expect(url.origin + url.pathname).toBe("https://www.pinterest.com/oauth/");
    expect(url.searchParams.get("scope")).toContain("pins:write");
  });
});

describe("pinterestAdapter.exchangeCode", () => {
  it("exchanges a code using HTTP Basic auth", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
      expect(init.headers.Authorization).toMatch(/^Basic /);
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-1", expires_in: 3600 }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await pinterestAdapter.exchangeCode({
      code: "abc",
      redirectUri: REDIRECT,
      state: "s",
    });
    expect(tokens.accessToken).toBe("tok-1");
  });
});

describe("pinterestAdapter.publish", () => {
  it("requires an image", async () => {
    await expect(
      pinterestAdapter.publish({ accessToken: "t", externalAccountId: "user", text: "x" })
    ).rejects.toThrow(/require an image/);
  });

  it("creates a pin on the first board", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/boards")) {
        return { ok: true, status: 200, json: async () => ({ items: [{ id: "board-1" }] }) };
      }
      return { ok: true, status: 201, json: async () => ({ id: "pin-1" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pinterestAdapter.publish({
      accessToken: "tok",
      externalAccountId: "user",
      text: "Hello Pinterest",
      imageUrl: "https://example.com/img.jpg",
    });
    expect(result.externalPostId).toBe("pin-1");
    expect(result.externalUrl).toContain("pin-1");
  });

  it("throws when the user has no boards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }))
    );
    await expect(
      pinterestAdapter.publish({
        accessToken: "tok",
        externalAccountId: "user",
        text: "x",
        imageUrl: "https://example.com/img.jpg",
      })
    ).rejects.toThrow(/No Pinterest board/);
  });
});
