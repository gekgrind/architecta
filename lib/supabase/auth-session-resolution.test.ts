import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as logout } from "@/app/auth/logout/route";
import { AUTH_NO_STORE_HEADERS } from "@/lib/supabase/auth-cookie-cleanup";
import { middleware } from "@/middleware";
import {
  ARCHITECTA_HOST,
  BrowserCookieJar,
  type Scope,
} from "@/test/browser-cookie-jar";
import {
  KEY,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "@/test/fake-auth-api";

/*
 * Two genuinely different session generations, one per scope. Next keeps
 * the last value per cookie name, so whichever family the browser sends
 * second is what a name-keyed reader sees — and a deletion derived from
 * it used to be retargeted at the canonical `.entrepreneuria.io` copy.
 * Every generation here has its own access token, refresh token and
 * expiry; the stubbed Auth API judges each one on its own.
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

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";

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

function logoutRequest(jar: BrowserCookieJar) {
  return request("/auth/logout", jar, { method: "POST" });
}

function expectUncacheable(response: Response) {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    expect(response.headers.get(key), key).toBe(value);
  }
}

type Stale = "revoked" | "expired-revoked" | "older-generation" | "corrupt";

/** A copy that must never win over the healthy one; null for corrupt chunks. */
function staleCopy(kind: Stale) {
  switch (kind) {
    case "revoked": {
      /* Unexpired JWT of a sign-in revoked server-side: the Auth API
         answers `session_not_found`, which rules it out. */
      const copy = api.generation({
        sessionId: SESSION_B,
        refreshLive: false,
        bulky: true,
      });
      api.revokeSession(SESSION_B);
      return copy;
    }
    case "expired-revoked":
      return api.generation({
        sessionId: SESSION_B,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
        bulky: true,
      });
    case "older-generation":
      /* An earlier point of the healthy sign-in's own refresh chain:
         refreshing it would be refresh-token reuse. */
      return api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      });
    case "corrupt":
      return null;
  }
}

function plantStale(jar: BrowserCookieJar, kind: Stale, scope: Scope) {
  const session = staleCopy(kind);

  if (session) {
    plant(jar, session, scope);
  } else {
    for (const name of [`${KEY}.0`, `${KEY}.1`, `${KEY}.2`]) {
      jar.set(name, "base64-eyJjb3JydXB0Ijp0cnVl", scope);
    }
  }
}

function sessionSetCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY));
}

function forwardedAccessTokens(response: Response) {
  const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
  const pairs = forwarded
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(KEY))
    .sort();
  const joined = pairs.map((pair) => pair.slice(pair.indexOf("=") + 1)).join("");

  if (!joined) return [];

  const session = JSON.parse(
    Buffer.from(
      decodeURIComponent(joined).replace(/^base64-/, ""),
      "base64url"
    ).toString()
  );

  return [session.access_token as string];
}

/* Moves the clock past every access token planted so far. */
function afterAccessTokensExpire() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
}

afterEach(() => {
  vi.useRealTimers();
});

const STALE_KINDS: Stale[] = [
  "revoked",
  "expired-revoked",
  "older-generation",
  "corrupt",
];
const ORDERS = ["canonical first", "host-only first"] as const;

/*
 * The contract, since an accepted access token proves nothing about the
 * refresh token beside it:
 *
 * - When the Auth API rules out every copy but the healthy one, a refresh
 *   proves the healthy pair at once; it is written canonically and every
 *   other copy retired.
 * - When another copy cannot be ruled out without a refresh (its access
 *   token has expired), the healthy session is served exactly as it is
 *   and nothing changes. Once its own access token expires too, two
 *   copies remain that only a refresh could tell apart, and refreshing
 *   either could destroy the other: the visitor is sent to an explicit
 *   recovery page instead of being signed in or out silently.
 */
const RULED_OUT: Stale[] = ["revoked", "corrupt"];

describe("middleware: distinct session generations in both scopes", () => {
  for (const kind of STALE_KINDS) {
    for (const order of ORDERS) {
      for (const healthyScope of ["shared-domain", "host-only"] as const) {
        const staleScope: Scope =
          healthyScope === "shared-domain" ? "host-only" : "shared-domain";
        const label = `healthy ${healthyScope} copy over a ${kind} ${staleScope} copy (${order})`;

        it(label, async () => {
          const jar = new BrowserCookieJar();
          const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
          const plantHealthy = () => plant(jar, healthy, healthyScope);
          const plantOther = () => plantStale(jar, kind, staleScope);

          if (order === "canonical first" === (healthyScope === "shared-domain")) {
            plantHealthy();
            plantOther();
          } else {
            plantOther();
            plantHealthy();
          }
          jar.set("unrelated-preference", "keep", staleScope);
          const before = jar.header();

          const response = await middleware(request("/dashboard", jar));

          expect(response.headers.get("location"), "not bounced").toBeNull();
          expect(api.state.reuseDetected).toBe(false);
          expect(api.isLive(SESSION_A)).toBe(true);

          if (RULED_OUT.includes(kind)) {
            /* The ruled-out copy's refresh token is presented first and
               yields nothing (it died with its sign-in); then the healthy
               pair is proven by its own refresh — the only rotation — and
               kept canonically. */
            expect(api.state.refreshedTokens.at(-1)).toBe(healthy.refresh_token);
            expect(api.state.rotations).toBe(1);
            expectUncacheable(response);
            jar.apply(response);
            expect(jar.names("host-only", KEY)).toEqual([]);
            expect(jar.names("shared-domain", KEY).length).toBeGreaterThan(0);
            expect(jar.get("unrelated-preference", staleScope)).toBe("keep");

            api.state.validatedTokens = [];
            const next = await middleware(request("/dashboard", jar));
            expect(next.headers.get("location")).toBeNull();
            expect(sessionSetCookies(next)).toEqual([]);
            expect(api.state.validatedTokens).toEqual([api.state.accessToken]);
            return;
          }

          /* Served, unchanged: nothing proved the pair or ruled the other
             copy out. */
          expect(api.state.refreshCalls).toBe(0);
          expect(sessionSetCookies(response)).toEqual([]);
          expect(forwardedAccessTokens(response)).toEqual([healthy.access_token]);
          jar.apply(response);
          expect(jar.header()).toBe(before);

          afterAccessTokensExpire();
          const later = await middleware(request("/dashboard", jar));

          expect(later.headers.get("location")).toMatch(
            /\/auth\/logout\/confirm\?reason=session-unresolved&next=%2Fdashboard$/
          );
          expect(api.state.refreshCalls).toBe(0);
          expect(sessionSetCookies(later)).toEqual([]);
          expect(api.isLive(SESSION_A)).toBe(true);
          expect(api.canRefresh(SESSION_A)).toBe(true);
        });
      }
    }
  }

  for (const order of ORDERS) {
    it(`never refreshes either of two expired generations (${order})`, async () => {
      const jar = new BrowserCookieJar();
      const older = api.generation({
        sessionId: SESSION_A,
        expiresIn: -120,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      });
      const newest = api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        bulky: true,
      });

      if (order === "canonical first") {
        plant(jar, newest, "shared-domain");
        plant(jar, older, "host-only");
      } else {
        plant(jar, older, "host-only");
        plant(jar, newest, "shared-domain");
      }
      const before = jar.header();

      const response = await middleware(request("/dashboard", jar));

      expect(response.headers.get("location")).toMatch(/reason=session-unresolved/);
      expect(api.state.refreshCalls).toBe(0);
      expect(api.state.reuseDetected).toBe(false);
      jar.apply(response);
      expect(jar.header()).toBe(before);
      expect(api.canRefresh(SESSION_A)).toBe(true);
    });
  }

  it("an identical session in both scopes is one session: the host-only copy goes", async () => {
    const jar = new BrowserCookieJar();
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "host-only");
    plant(jar, healthy, "shared-domain");

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location")).toBeNull();
    for (const header of sessionSetCookies(response)) {
      expect(/Domain=/i.test(header), header).toBe(false);
    }
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual(
      sessionChunks(healthy).map(({ name }) => name)
    );
    expect(jar.names("host-only", KEY)).toEqual([]);
  });

  for (const outage of ["down", "unavailable"] as const) {
    it(`touches neither scope while the Auth API is ${outage}`, async () => {
      for (const healthyScope of ["shared-domain", "host-only"] as const) {
        const jar = new BrowserCookieJar();
        const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
        const staleScope =
          healthyScope === "shared-domain" ? "host-only" : "shared-domain";
        plant(jar, healthy, healthyScope);
        plantStale(jar, "revoked", staleScope);
        const before = jar.header();

        api.state.mode = outage;
        for (const path of ["/dashboard", "/"]) {
          const response = await middleware(request(path, jar));

          expect(sessionSetCookies(response), `${healthyScope} ${path}`).toEqual([]);
          jar.apply(response);
        }
        expect(jar.header()).toBe(before);

        api.state.mode = "up";
        const recovered = await middleware(request("/dashboard", jar));
        expect(recovered.headers.get("location")).toBeNull();
        jar.apply(recovered);
        expect(jar.names("host-only", KEY)).toEqual([]);
      }
    });
  }

  it("signs out only when every generation is ruled out, in both scopes", async () => {
    const jar = new BrowserCookieJar();
    plant(
      jar,
      api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
      }),
      "shared-domain"
    );
    plantStale(jar, "revoked", "host-only");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location")).toMatch(
      /^https:\/\/entrepreneuria\.io\/login\?next=/
    );
    expectUncacheable(response);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
  });

  it("forwards only the served session to Server Components and route handlers", async () => {
    const jar = new BrowserCookieJar();
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    plantStale(jar, "expired-revoked", "host-only");

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "cookie"
    );
    expect(forwardedAccessTokens(response)).toEqual([healthy.access_token]);
  });
});

describe("logout: distinct session generations in both scopes", () => {
  it("revokes every distinct sign-in and expires both scopes", async () => {
    const jar = new BrowserCookieJar();
    const canonical = api.generation({ sessionId: SESSION_A, bulky: true });
    const hostOnly = api.generation({ sessionId: SESSION_B, bulky: true });
    plant(jar, canonical, "shared-domain");
    plant(jar, hostOnly, "host-only");
    jar.set("unrelated-preference", "keep", "host-only");

    const response = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    expect(api.isLive(SESSION_B)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
    expect(api.state.reuseDetected).toBe(false);
    expectUncacheable(response);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.get("unrelated-preference", "host-only")).toBe("keep");
  });

  it("a superseded generation's refresh token is only presented after sign-out, so it finds nothing to reuse", async () => {
    const jar = new BrowserCookieJar();
    const newest = api.generation({ sessionId: SESSION_A, bulky: true });
    const older = api.generation({
      sessionId: SESSION_A,
      expiresIn: -120,
      accessLive: false,
      refreshLive: false,
      consumed: true,
      bulky: true,
    });
    plant(jar, newest, "shared-domain");
    plant(jar, older, "host-only");

    const response = await logout(logoutRequest(jar));

    expect(api.state.loggedOutTokens[0]).toBe(newest.access_token);
    expect(api.state.reuseDetected).toBe(false);
    expect(api.isLive(SESSION_A)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
  });
});
