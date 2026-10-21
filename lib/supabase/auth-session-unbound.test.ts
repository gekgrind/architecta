import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as logout } from "@/app/auth/logout/route";
import { LOGOUT_PATH, SESSION_RECOVERY_PATH } from "@/lib/auth/redirects";
import { readAuthCookieInventory } from "@/lib/supabase/auth-cookie-cleanup";
import { middleware } from "@/middleware";
import { ARCHITECTA_HOST, BrowserCookieJar } from "@/test/browser-cookie-jar";
import {
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  USER_ID,
  fakeUser,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "@/test/fake-auth-api";

/*
 * Grafted-profile sessions: tokens of one sign-in stored beside a cached
 * user that is not the token's subject. They are never a session to
 * serve, but their tokens may still work, so nothing deletes them before
 * the Auth API rules them out, and sign-out revokes them.
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
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";
const ORIGIN = `https://${ARCHITECTA_HOST}`;
/* What a route handler sees under `next start` behind nginx. */
const BIND = "http://localhost:3000";

function request(
  path: string,
  jar: BrowserCookieJar,
  headers: Record<string, string> = {},
  method = "GET",
  base = ORIGIN
) {
  return new NextRequest(`${base}${path}`, {
    method,
    headers: {
      host: ARCHITECTA_HOST,
      cookie: jar.header(new URL(path, "https://x").pathname),
      ...headers,
    },
  });
}

const logoutRequest = (jar: BrowserCookieJar, base = ORIGIN) =>
  request(LOGOUT_PATH, jar, { origin: ORIGIN }, "POST", base);

const sessionWrites = (response: Response) =>
  response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY) && !/Max-Age=0/.test(header));

/** B's own tokens under A's cached profile. */
function grafted(options: Parameters<FakeAuthApi["generation"]>[0]) {
  return {
    ...api.generation({ userId: OTHER_USER_ID, ...options }),
    user: fakeUser(false, USER_ID),
  };
}

describe("a grafted-profile session alone", () => {
  it("is held for revocation only, by the token's own subject, and is a conflict", () => {
    const jar = new BrowserCookieJar();
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");

    const inventory = readAuthCookieInventory(request("/dashboard", jar));

    expect(inventory.candidates).toEqual([]);
    expect(inventory.revocationOnly.map(({ userId }) => userId)).toEqual([
      OTHER_USER_ID,
    ]);
    expect(inventory.conflict).toBe(true);
  });

  for (const [label, expiresIn] of [
    ["with a working access token", 3600],
    ["with an expired access token and a working refresh token", -60],
  ] as const) {
    it(`${label} is never served, refreshed or deleted by a request`, async () => {
      const jar = new BrowserCookieJar();
      plant(jar, grafted({ sessionId: SESSION_B, expiresIn }), "shared-domain");
      const before = jar.header();

      const response = await middleware(request("/dashboard", jar));

      expect(response.headers.get("location") ?? "").toContain(
        `${SESSION_RECOVERY_PATH}?reason=session-unresolved`
      );
      expect(api.state.refreshCalls).toBe(0);
      expect(sessionWrites(response)).toEqual([]);
      jar.apply(response);
      expect(jar.header()).toBe(before);
      expect(api.isLive(SESSION_B)).toBe(true);
    });
  }

  it("is retired once the Auth API rules both of its tokens out", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, grafted({ sessionId: SESSION_B, refreshLive: false }), "shared-domain");
    api.revokeSession(SESSION_B);

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location") ?? "").not.toContain(SESSION_RECOVERY_PATH);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
  });

  it("is revoked by sign-out, which is complete only then", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");

    const response = await logout(logoutRequest(jar, BIND));

    expect(api.isLive(SESSION_B)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
    /* Complete: on to the shared Entrepreneuria login, never localhost. */
    expect(response.headers.get("location") ?? "").toMatch(
      /^https:\/\/entrepreneuria\.io\/login\?/
    );
  });

  it("leaves sign-out incomplete when it cannot be revoked", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");
    api.state.logoutFailure = 500;

    const response = await logout(logoutRequest(jar, BIND));

    expect(api.isLive(SESSION_B)).toBe(true);
    expect(response.headers.get("x-auth-revocation")).toBe("incomplete");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}${SESSION_RECOVERY_PATH}?status=incomplete`
    );
  });
});

describe("half a session", () => {
  it("a lone refresh token beside a real session is revoked by logout", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, expiresIn: -60 }),
        access_token: null,
      },
      "host-only"
    );
    expect(readAuthCookieInventory(request("/dashboard", jar)).revocationOnly).toHaveLength(1);

    const response = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    expect(api.isLive(SESSION_B)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
  });

  it("a lone access token beside a real session is revoked by logout", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID }),
        refresh_token: null,
      },
      "host-only"
    );

    const response = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    expect(api.isLive(SESSION_B)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
  });

  it("alone, it is never refreshed or deleted by a request", async () => {
    const jar = new BrowserCookieJar();
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, expiresIn: -60 }),
        access_token: null,
      },
      "shared-domain"
    );
    const before = jar.header();

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location") ?? "").toContain(
      `${SESSION_RECOVERY_PATH}?reason=session-unresolved`
    );
    expect(api.state.refreshCalls).toBe(0);
    jar.apply(response);
    expect(jar.header()).toBe(before);
  });
});

describe("a session split past the assembly budget", () => {
  it("is never served or refreshed, and its cookies stay", async () => {
    const jar = new BrowserCookieJar();
    const encoded = `base64-${Buffer.from(
      JSON.stringify(grafted({ sessionId: SESSION_B, expiresIn: -60 }))
    ).toString("base64url")}`;
    const size = Math.max(1, Math.floor(encoded.length / 70));
    for (let index = 0; index * size < encoded.length; index += 1) {
      jar.set(`${KEY}.${index}`, encoded.slice(index * size, (index + 1) * size), "shared-domain");
    }
    expect(jar.names("shared-domain", KEY).length).toBeGreaterThanOrEqual(65);
    const inventory = readAuthCookieInventory(request("/dashboard", jar));
    expect(inventory.candidatesTruncated).toBe(true);
    expect(inventory.conflict).toBe(true);
    const before = jar.header();

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location") ?? "").toContain(
      `${SESSION_RECOVERY_PATH}?reason=session-unresolved`
    );
    expect(api.state.refreshCalls).toBe(0);
    expect(sessionWrites(response)).toEqual([]);
    jar.apply(response);
    expect(jar.header()).toBe(before);
  });
});

describe("logout behind the bind address", () => {
  it("expires the shared session in both scopes even when revocation fails", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    api.state.logoutFailure = 500;

    /* nginx forwards the public Host; only request.url is the bind address. */
    const response = await logout(logoutRequest(jar, BIND));

    expect(response.headers.get("x-auth-revocation")).toBe("incomplete");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}${SESSION_RECOVERY_PATH}?status=incomplete`
    );
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
  });
});

describe("a grafted-profile session beside a real one", () => {
  it("survives an ordinary request untouched, then sign-out revokes it", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(jar, grafted({ sessionId: SESSION_B }), "host-only");
    const hostOnlyBefore = jar.names("host-only", KEY);
    expect(hostOnlyBefore.length).toBeGreaterThan(0);

    const response = await middleware(request("/dashboard", jar));
    jar.apply(response);

    expect(jar.names("host-only", KEY)).toEqual(hostOnlyBefore);
    expect(api.isLive(SESSION_B)).toBe(true);

    const signedOut = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    expect(api.isLive(SESSION_B)).toBe(false);
    expect(signedOut.headers.get("x-auth-revocation")).toBe("complete");
  });
});
