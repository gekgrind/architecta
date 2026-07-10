import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { instagramAdapter } from "./instagram";

const REDIRECT = "https://architecta.example/api/connections/instagram/callback";

beforeEach(() => {
  process.env.META_APP_ID = "meta-123";
  process.env.META_APP_SECRET = "meta-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("instagramAdapter.buildAuthUrl", () => {
  it("builds a valid authorize URL with scope + state", () => {
    const url = new URL(
      instagramAdapter.buildAuthUrl({ state: "instagram.nonce", redirectUri: REDIRECT })
    );
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
  });
});

describe("instagramAdapter.getAccountIdentity", () => {
  it("returns the IG business account linked to a managed Page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "page-1",
              access_token: "page-token",
              instagram_business_account: { id: "ig-1", username: "myhandle" },
            },
          ],
        }),
      }))
    );
    const id = await instagramAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] });
    expect(id.externalAccountId).toBe("ig-1");
    expect(id.externalAccountName).toBe("myhandle");
  });

  it("throws when no Page has a linked Instagram account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "page-1", access_token: "page-token" }] }),
      }))
    );
    await expect(
      instagramAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] })
    ).rejects.toThrow(/No Instagram professional account/);
  });
});

describe("instagramAdapter.publish", () => {
  it("requires an image", async () => {
    await expect(
      instagramAdapter.publish({ accessToken: "t", externalAccountId: "ig-1", text: "x" })
    ).rejects.toThrow(/require an image/);
  });

  it("creates a media container then publishes it", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/me/accounts")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "page-1",
                access_token: "page-token",
                instagram_business_account: { id: "ig-1", username: "myhandle" },
              },
            ],
          }),
        };
      }
      if (url.includes("fields=permalink")) {
        return { ok: true, status: 200, json: async () => ({ permalink: "https://instagram.com/p/x" }) };
      }
      if (url.includes("/media_publish")) {
        return { ok: true, status: 200, json: async () => ({ id: "media-999" }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: "creation-1" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await instagramAdapter.publish({
      accessToken: "user-tok",
      externalAccountId: "ig-1",
      text: "Hello Instagram",
      imageUrl: "https://example.com/img.jpg",
    });
    expect(result.externalPostId).toBe("media-999");
    expect(result.externalUrl).toBe("https://instagram.com/p/x");
  });
});
