import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as logout } from "@/app/auth/logout/route";
import { AUTH_NO_STORE_HEADERS } from "@/lib/supabase/auth-cookie-cleanup";
import {
  ARCHITECTA_HOST,
  BrowserCookieJar,
} from "@/test/browser-cookie-jar";
import {
  DEFAULT_SESSION_ID,
  KEY,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "@/test/fake-auth-api";

import { middleware } from "./middleware";

/*
 * Every redirect the middleware can take must carry the session
 * mutations Supabase made before it: refreshed chunks, deletions of a
 * dead session, and the anti-cache headers @supabase/ssr hands setAll.
 * These drive the real middleware and read the actual response headers.
 */

let api: FakeAuthApi;

beforeEach(() => {
  api = installFakeAuthApi();
  vi.stubGlobal("fetch", api.fetchStub);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-anon-key");
  vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_APP_URL", "https://entrepreneuria.io");
  vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", `https://${ARCHITECTA_HOST}`);
  vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(
  path: string,
  jar: BrowserCookieJar,
  { method = "GET" }: { method?: string } = {}
) {
  return new NextRequest(`https://${ARCHITECTA_HOST}${path}`, {
    method,
    headers: {
      host: ARCHITECTA_HOST,
      cookie: jar.header(new URL(path, "https://x").pathname),
      ...(method === "POST" ? { origin: `https://${ARCHITECTA_HOST}` } : {}),
    },
  });
}

/* An earlier generation of the default sign-in: its refresh token was
   already rotated into the current one. */
function supersededGeneration() {
  return api.generation({
    sessionId: DEFAULT_SESSION_ID,
    expiresIn: -120,
    accessLive: false,
    refreshLive: false,
    consumed: true,
    bulky: true,
  });
}

function expectUncacheable(response: Response) {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    expect(response.headers.get(key), key).toBe(value);
  }
}

/** Set-Cookie headers that write (not expire) a shared-session chunk. */
function sessionWrites(response: Response) {
  return response.headers
    .getSetCookie()
    .filter(
      (header) =>
        header.startsWith(`${KEY}`) &&
        !/Max-Age=0/i.test(header) &&
        /Domain=\.entrepreneuria\.io/i.test(header)
    );
}

function sessionDeletions(response: Response) {
  return response.headers
    .getSetCookie()
    .filter(
      (header) =>
        header.startsWith(`${KEY}`) &&
        /Max-Age=0/i.test(header) &&
        /Domain=\.entrepreneuria\.io/i.test(header)
    );
}

/* A browser whose access token has expired: the middleware refreshes. */
function expiredSessionJar() {
  const jar = new BrowserCookieJar();
  plant(jar, api.storedSession({ expiresIn: -60 }), "shared-domain");
  jar.set("unrelated-preference", "keep", "shared-domain");

  return jar;
}

describe("middleware redirects keep the session mutations made before them", () => {
  const categories = [
    {
      name: "authenticated onboarding redirect (Architecta area, onboarding incomplete)",
      path: "/dashboard",
      setup: () => {
        api.state.onboardingComplete = false;
      },
      location: `https://${ARCHITECTA_HOST}/onboarding`,
    },
    {
      name: "authenticated dashboard redirect (onboarding already complete)",
      path: "/onboarding",
      setup: () => {},
      location: `https://${ARCHITECTA_HOST}/dashboard`,
    },
    {
      name: "authenticated redirect away from the auth pages",
      path: "/auth/login?next=%2Fcalendar",
      setup: () => {},
      location: `https://${ARCHITECTA_HOST}/calendar`,
    },
    {
      name: "authenticated redirect to access denied",
      path: "/library",
      setup: () => {
        api.state.architectaAccess = false;
      },
      location: `https://${ARCHITECTA_HOST}/access-denied`,
    },
  ];

  for (const category of categories) {
    it(`${category.name}: refreshed chunks survive`, async () => {
      const jar = expiredSessionJar();
      api.state.refreshBulky = true;
      category.setup();

      const response = await middleware(request(category.path, jar));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(category.location);
      expect(api.state.refreshCalls).toBe(1);
      /* The bulky refreshed session needs several chunks; all of them. */
      expect(sessionWrites(response).length).toBeGreaterThanOrEqual(2);
      expectUncacheable(response);

      jar.apply(response);
      api.state.validatedTokens = [];
      await middleware(request("/", jar));
      expect(api.state.refreshCalls).toBe(1);
      expect(api.state.validatedTokens).toEqual([api.state.accessToken]);
      expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
    });
  }

  it("unauthenticated redirect: deletions of a revoked session survive", async () => {
    const jar = new BrowserCookieJar();
    plant(
      jar,
      api.storedSession({ refreshToken: "revoked-refresh-token", expiresIn: -60 }),
      "shared-domain"
    );
    jar.set("unrelated-preference", "keep", "shared-domain");
    const planted = jar.names("shared-domain", KEY);

    const response = await middleware(request("/dashboard", jar));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/entrepreneuria\.io\/login\?next=/
    );
    expect(
      sessionDeletions(response).map((header) => header.split("=")[0]).sort()
    ).toEqual(planted);
    expectUncacheable(response);

    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
  });

  it("unauthenticated redirect: retirement of corrupt cookies survives", async () => {
    const jar = new BrowserCookieJar();
    jar.set(KEY, "base64-corrupt!!", "shared-domain");
    jar.set(`${KEY}.0`, "stale", "host-only");

    const response = await middleware(request("/calendar", jar));

    expect(response.status).toBe(307);
    expectUncacheable(response);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
  });

  it("unauthenticated redirect with no cookies writes nothing", async () => {
    const response = await middleware(request("/dashboard", new BrowserCookieJar()));

    expect(response.status).toBe(307);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("a pass-through response carries the refresh and its headers", async () => {
    const jar = expiredSessionJar();

    const response = await middleware(request("/", jar));

    expect(response.headers.get("location")).toBeNull();
    expect(sessionWrites(response).length).toBeGreaterThanOrEqual(1);
    expectUncacheable(response);
  });

  it("host-only duplicates are retired on a redirect too", async () => {
    /* Provable: the host-only copy is a revoked sign-in the Auth API
       rules out, and the canonical one is proven by its own refresh,
       bound to the access token the Auth API accepted beside it. */
    const jar = new BrowserCookieJar();
    plant(
      jar,
      api.generation({ sessionId: DEFAULT_SESSION_ID, bulky: true }),
      "shared-domain"
    );
    const revoked = api.generation({
      sessionId: "00000000-0000-4000-8000-0000000000bb",
      refreshLive: false,
      bulky: true,
    });
    api.revokeSession("00000000-0000-4000-8000-0000000000bb");
    plant(jar, revoked, "host-only");
    api.state.onboardingComplete = false;

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location")).toBe(
      `https://${ARCHITECTA_HOST}/onboarding`
    );
    jar.apply(response);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.names("shared-domain", KEY).length).toBeGreaterThan(0);
  });

  it("logout: the middleware stays out of the way and the route expires both scopes", async () => {
    const jar = expiredSessionJar();
    plant(jar, supersededGeneration(), "host-only");

    const passed = await middleware(
      request("/auth/logout", jar, { method: "POST" })
    );
    expect(passed.headers.get("x-middleware-next")).toBe("1");
    expect(passed.headers.getSetCookie()).toEqual([]);
    expect(api.state.refreshCalls).toBe(0);

    const response = await logout(
      request("/auth/logout", jar, { method: "POST" })
    );

    expect(response.status).toBe(303);
    expect(api.isLive(DEFAULT_SESSION_ID)).toBe(false);
    expect(api.state.reuseDetected).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/entrepreneuria\.io\/login\?next=/
    );
    expectUncacheable(response);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
  });
});
