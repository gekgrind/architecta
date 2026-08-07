import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeSiteUrl, wordpressAdapter } from "./wordpress";
import type { DestinationCredentials, DestinationSession } from "../types";

const SITE = "https://blog.example.com";

const credentials: DestinationCredentials = {
  secret: "abcd EFGH ijkl MNOP",
  refreshSecret: null,
  config: { siteUrl: SITE, username: "founder" },
};

const session: DestinationSession = {
  credentials,
  identity: { externalAccountId: "7", externalAccountName: "Founder" },
};

const content = {
  title: "Launch week",
  html: "<p>Hello</p>",
  slug: "launch-week",
  categories: [],
  tags: [],
  featuredImageUrl: null,
};

type MockCall = { url: string; init: RequestInit };

/** Route mock responses by URL substring; records every call for assertions. */
function stubFetch(routes: Array<{ match: string; status?: number; json: unknown }>) {
  const calls: MockCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const route = routes.find((r) => url.includes(r.match));
      const status = route?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => route?.json ?? {},
        headers: { get: () => null },
      };
    })
  );
  return calls;
}

function bodyOf(call: MockCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("normalizeSiteUrl", () => {
  it("strips a trailing slash but keeps a subdirectory install", () => {
    expect(normalizeSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeSiteUrl("https://example.com/blog/")).toBe("https://example.com/blog");
  });

  it("rejects http, because the application password rides on every request", () => {
    expect(() => normalizeSiteUrl("http://example.com")).toThrow(/https/i);
  });

  it("rejects loopback and private hosts (SSRF guard)", () => {
    expect(() => normalizeSiteUrl("https://localhost")).toThrow(/reachable public/i);
    expect(() => normalizeSiteUrl("https://127.0.0.1")).toThrow(/reachable public/i);
    expect(() => normalizeSiteUrl("https://192.168.1.10")).toThrow(/reachable public/i);
    expect(() => normalizeSiteUrl("https://169.254.169.254")).toThrow(/reachable public/i);
  });

  it("rejects a value that isn't a URL", () => {
    expect(() => normalizeSiteUrl("example.com")).toThrow(/full site URL/i);
  });
});

describe("wordpressAdapter.connect", () => {
  it("authenticates with Basic auth and returns the account identity", async () => {
    const calls = stubFetch([
      { match: "/users/me", json: { id: 7, name: "Founder", capabilities: { edit_posts: true } } },
    ]);

    const result = await wordpressAdapter.connect({
      method: "credentials",
      values: {
        siteUrl: `${SITE}/`,
        username: "founder",
        applicationPassword: "abcd EFGH ijkl MNOP",
      },
    });

    expect(result.identity).toEqual({ externalAccountId: "7", externalAccountName: "Founder" });
    expect(result.credentials.config).toEqual({ siteUrl: SITE, username: "founder" });

    // Spaces are stripped from the application password, as WordPress does.
    const headers = calls[0].init.headers as Record<string, string>;
    const decoded = Buffer.from(headers.Authorization.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("founder:abcdEFGHijklMNOP");
    expect(calls[0].url).toBe(`${SITE}/wp-json/wp/v2/users/me?context=edit`);
  });

  it("surfaces a rejected credential rather than storing it", async () => {
    stubFetch([
      { match: "/users/me", status: 401, json: { message: "Incorrect password." } },
    ]);

    await expect(
      wordpressAdapter.connect({
        method: "credentials",
        values: { siteUrl: SITE, username: "founder", applicationPassword: "nope" },
      })
    ).rejects.toThrow(/Incorrect password/);
  });

  it("refuses an account that can't create posts", async () => {
    stubFetch([
      { match: "/users/me", json: { id: 9, name: "Subscriber", capabilities: { edit_posts: false } } },
    ]);

    await expect(
      wordpressAdapter.connect({
        method: "credentials",
        values: { siteUrl: SITE, username: "sub", applicationPassword: "pw" },
      })
    ).rejects.toThrow(/can't create posts/);
  });
});

describe("wordpressAdapter.validateConnection", () => {
  it("reports the host and account on success", async () => {
    stubFetch([{ match: "/users/me", json: { id: 7, name: "Founder" } }]);
    const check = await wordpressAdapter.validateConnection(session);
    expect(check.ok).toBe(true);
    expect(check.detail).toContain("blog.example.com");
  });

  it("returns a reason instead of throwing when the site is unreachable", async () => {
    stubFetch([{ match: "/users/me", status: 403, json: { message: "Sorry, you are not allowed." } }]);
    const check = await wordpressAdapter.validateConnection(session);
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("not allowed");
  });
});

describe("wordpressAdapter.createDraft", () => {
  it("creates the post with status draft", async () => {
    const calls = stubFetch([
      { match: "/posts", json: { id: 42, link: `${SITE}/?p=42`, status: "draft" } },
    ]);

    const result = await wordpressAdapter.createDraft({ ...session, content });

    expect(result).toEqual({
      externalId: "42",
      externalUrl: `${SITE}/?p=42`,
      status: "draft",
    });
    expect(calls[0].url).toBe(`${SITE}/wp-json/wp/v2/posts`);
    expect(bodyOf(calls[0])).toMatchObject({
      title: "Launch week",
      content: "<p>Hello</p>",
      slug: "launch-week",
      status: "draft",
    });
  });

  it("resolves tag names to ids and creates the ones that don't exist", async () => {
    const calls = stubFetch([
      { match: "/tags?search=growth", json: [{ id: 3, name: "Growth", slug: "growth" }] },
      { match: "/tags?search=launch", json: [] },
      { match: "/tags", json: { id: 11, name: "launch", slug: "launch" } },
      { match: "/posts", json: { id: 42, link: `${SITE}/?p=42` } },
    ]);

    await wordpressAdapter.createDraft({
      ...session,
      content: { ...content, tags: ["growth", "launch"] },
    });

    const postCall = calls.find((c) => c.url.endsWith("/wp/v2/posts"));
    expect(bodyOf(postCall!).tags).toEqual([3, 11]);
  });

  it("never creates categories — unmatched ones are left off the draft", async () => {
    const calls = stubFetch([
      { match: "/categories?search=", json: [] },
      { match: "/posts", json: { id: 42, link: `${SITE}/?p=42` } },
    ]);

    await wordpressAdapter.createDraft({
      ...session,
      content: { ...content, categories: ["Nonexistent"] },
    });

    expect(calls.some((c) => c.url.includes("/categories") && c.init.method === "POST")).toBe(false);
    const postCall = calls.find((c) => c.url.endsWith("/wp/v2/posts"));
    expect(bodyOf(postCall!).categories).toBeUndefined();
  });
});

describe("wordpressAdapter.publish", () => {
  it("promotes an existing draft by id", async () => {
    const calls = stubFetch([
      { match: "/posts/42", json: { id: 42, link: `${SITE}/launch-week`, status: "publish" } },
    ]);

    const result = await wordpressAdapter.publish({
      ...session,
      content,
      externalId: "42",
    });

    expect(result).toEqual({
      externalId: "42",
      externalUrl: `${SITE}/launch-week`,
      status: "published",
    });
    expect(calls[0].url).toBe(`${SITE}/wp-json/wp/v2/posts/42`);
    expect(bodyOf(calls[0])).toEqual({ status: "publish" });
  });
});

describe("wordpressAdapter.schedule", () => {
  it("sets status future with a naive GMT timestamp", async () => {
    const calls = stubFetch([{ match: "/posts/42", json: { id: 42, link: null } }]);

    const result = await wordpressAdapter.schedule({
      ...session,
      content,
      externalId: "42",
      scheduledFor: "2026-09-01T14:30:00.000Z",
    });

    expect(result.status).toBe("scheduled");
    expect(bodyOf(calls[0])).toEqual({
      status: "future",
      date_gmt: "2026-09-01T14:30:00",
    });
  });
});
