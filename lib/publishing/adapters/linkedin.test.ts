import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { linkedinAdapter } from "./linkedin";

const REDIRECT = "https://architecta.example/api/connections/linkedin/callback";

beforeEach(() => {
  process.env.LINKEDIN_CLIENT_ID = "client-123";
  process.env.LINKEDIN_CLIENT_SECRET = "secret-abc";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("linkedinAdapter.buildAuthUrl", () => {
  it("builds a valid authorize URL with scope + state", () => {
    const url = new URL(
      linkedinAdapter.buildAuthUrl({ state: "linkedin.nonce", redirectUri: REDIRECT })
    );
    expect(url.origin + url.pathname).toBe(
      "https://www.linkedin.com/oauth/v2/authorization"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("linkedin.nonce");
    expect(url.searchParams.get("scope")).toContain("w_member_social");
  });

  it("throws a config error when client creds are missing", () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    expect(() =>
      linkedinAdapter.buildAuthUrl({ state: "s", redirectUri: REDIRECT })
    ).toThrow(/LINKEDIN_CLIENT_ID/);
  });
});

describe("linkedinAdapter.exchangeCode", () => {
  it("exchanges a code for tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "tok-1",
          expires_in: 3600,
          scope: "openid profile w_member_social",
        }),
      }))
    );
    const tokens = await linkedinAdapter.exchangeCode({
      code: "abc",
      redirectUri: REDIRECT,
      state: "linkedin.nonce",
    });
    expect(tokens.accessToken).toBe("tok-1");
    expect(tokens.scopes).toContain("w_member_social");
    expect(tokens.expiresAt).toBeTruthy();
  });

  it("throws on a token error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error_description: "bad code" }),
      }))
    );
    await expect(
      linkedinAdapter.exchangeCode({ code: "bad", redirectUri: REDIRECT, state: "linkedin.nonce" })
    ).rejects.toThrow(/bad code/);
  });
});

describe("linkedinAdapter.getAccountIdentity", () => {
  it("reads the member id + name from userinfo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ sub: "member-xyz", name: "Misti G" }),
      }))
    );
    const id = await linkedinAdapter.getAccountIdentity({
      accessToken: "tok",
      scopes: [],
    });
    expect(id.externalAccountId).toBe("member-xyz");
    expect(id.externalAccountName).toBe("Misti G");
  });
});

describe("linkedinAdapter.publish", () => {
  it("posts text and returns the created post URN + URL", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      void init;
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "x-restli-id": "urn:li:share:999" }),
        json: async () => ({}),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await linkedinAdapter.publish({
      accessToken: "tok",
      externalAccountId: "member-xyz",
      text: "Hello LinkedIn",
    });

    expect(result.externalPostId).toBe("urn:li:share:999");
    expect(result.externalUrl).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:999"
    );

    // Verify the request used the author URN + commentary.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.author).toBe("urn:li:person:member-xyz");
    expect(body.commentary).toBe("Hello LinkedIn");
    expect(body.lifecycleState).toBe("PUBLISHED");
  });

  it("throws when LinkedIn rejects the post", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        headers: new Headers(),
        json: async () => ({ message: "nope" }),
      }))
    );
    await expect(
      linkedinAdapter.publish({ accessToken: "t", externalAccountId: "m", text: "x" })
    ).rejects.toThrow(/LinkedIn post failed/);
  });
});
