import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignOutConfirmPage from "@/app/auth/logout/confirm/page";
import { GET as logoutGet, POST as logout } from "@/app/auth/logout/route";
import { submitLogout } from "@/lib/auth/logout-client";
import { LOGOUT_PATH, SESSION_RECOVERY_PATH } from "@/lib/auth/redirects";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { readAuthCookieInventory } from "@/lib/supabase/auth-cookie-cleanup";
import {
  MAX_JUDGED_CANDIDATES,
  resolveSessionConflict,
  revokeSessionCandidates,
} from "@/lib/supabase/auth-session-resolution";
import { getSharedSupabaseCookieOptions } from "@/lib/supabase/cookies";
import { middleware } from "@/middleware";
import {
  ARCHITECTA_HOST,
  BrowserCookieJar,
  type Scope,
} from "@/test/browser-cookie-jar";
import {
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "@/test/fake-auth-api";

/*
 * Adversarial regressions for session resolution and sign-out. A cookie
 * is attacker-controllable data — any host on `.entrepreneuria.io` can
 * plant one — so nothing it claims (expiry, sign-in, user) may on its
 * own cause a session to be adopted, deleted, refreshed into reuse, or
 * reported revoked. The fake Auth API keeps GoTrue's server state, so
 * these assert on what is actually live, refreshable or revoked.
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";
const SESSION_C = "00000000-0000-4000-8000-0000000000cc";
const ORIGIN = `https://${ARCHITECTA_HOST}`;
const SCOPES: [Scope, Scope][] = [
  ["shared-domain", "host-only"],
  ["host-only", "shared-domain"],
];

function request(
  path: string,
  jar: BrowserCookieJar,
  headers: Record<string, string> = {},
  method = "GET"
) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: {
      host: ARCHITECTA_HOST,
      cookie: jar.header(new URL(path, "https://x").pathname),
      ...headers,
    },
  });
}

function logoutRequest(jar: BrowserCookieJar, headers: Record<string, string> = {}) {
  return request(LOGOUT_PATH, jar, { origin: ORIGIN, ...headers }, "POST");
}

const config = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: "fake-anon-key",
  cookieOptions: getSharedSupabaseCookieOptions(ARCHITECTA_HOST),
});

function inventoryOf(jar: BrowserCookieJar) {
  return readAuthCookieInventory(request("/dashboard", jar));
}

function sessionSetCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY));
}

function forwardedSession(response: Response) {
  const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
  const joined = forwarded
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(KEY))
    .sort()
    .map((pair) => pair.slice(pair.indexOf("=") + 1))
    .join("");

  return joined
    ? (JSON.parse(
        Buffer.from(
          decodeURIComponent(joined).replace(/^base64-/, ""),
          "base64url"
        ).toString()
      ) as Record<string, unknown>)
    : null;
}

/** A copy of a sign-in revoked server-side whose JWT has not expired. */
function revokedCopy(sessionId: string) {
  const copy = api.generation({ sessionId, refreshLive: false, bulky: true });
  api.revokeSession(sessionId);
  return copy;
}

function afterAccessTokensExpire() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
}

async function renderPage(params: Record<string, string>) {
  return renderToStaticMarkup(
    await SignOutConfirmPage({ searchParams: Promise.resolve(params) })
  );
}

describe("Codex probe 1: an access token never vouches for the refresh token beside it", () => {
  for (const [label, otherUser] of [
    ["same user", undefined],
    ["another user", OTHER_USER_ID],
  ] as const) {
    for (const [mismatchScope, otherScope] of SCOPES) {
      it(`A's access + B's refresh (${label}, in ${mismatchScope}) is never adopted`, async () => {
        const jar = new BrowserCookieJar();
        const a = api.generation({ sessionId: SESSION_A, bulky: true });
        const b = api.generation({ sessionId: SESSION_B, userId: otherUser, bulky: true });
        /* The probe: A's live access token, B's live refresh token. */
        plant(jar, { ...a, refresh_token: b.refresh_token }, mismatchScope);
        /* A copy the Auth API rules out, so the probe is the only open
           candidate — the case that used to be canonicalized. */
        plant(jar, revokedCopy(SESSION_C), otherScope);
        const before = jar.header();

        const resolution = await resolveSessionConflict(inventoryOf(jar), config());
        expect(resolution.status).toBe("unresolved");

        const response = await middleware(request("/dashboard", jar));

        expect(response.headers.get("location")).toMatch(/reason=session-unresolved/);
        expect(sessionSetCookies(response)).toEqual([]);
        expect(forwardedSession(response)).toBeNull();
        jar.apply(response);
        expect(jar.header()).toBe(before);
        /* Neither sign-in was revoked or lost. B's refresh token was
           rotated by the proof attempt, but presenting it again is the
           parent-of-active case: B stays refreshable. */
        expect(api.isLive(SESSION_A)).toBe(true);
        expect(api.isLive(SESSION_B)).toBe(true);
        expect(api.canRefresh(SESSION_B)).toBe(true);
        expect(api.state.reuseDetected).toBe(false);
      });
    }
  }

  it("beside A's own family the probe is served as A, adopted nowhere, B never presented", async () => {
    const jar = new BrowserCookieJar();
    const a = api.generation({ sessionId: SESSION_A, bulky: true });
    const b = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true });
    plant(jar, a, "shared-domain");
    plant(jar, { ...a, refresh_token: b.refresh_token }, "host-only");
    const before = jar.header();

    const response = await middleware(request("/dashboard", jar));

    expect(response.headers.get("location")).toBeNull();
    expect(forwardedSession(response)?.access_token).toBe(a.access_token);
    expect(sessionSetCookies(response)).toEqual([]);
    expect(api.state.refreshedTokens).toEqual([]);
    jar.apply(response);
    expect(jar.header()).toBe(before);
  });

  it("the probe alone, once its access token expires, is still not adopted", async () => {
    const jar = new BrowserCookieJar();
    const a = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    const b = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    plant(jar, { ...a, refresh_token: b.refresh_token }, "host-only");
    plant(jar, revokedCopy(SESSION_C), "shared-domain");

    const resolution = await resolveSessionConflict(inventoryOf(jar), config());

    /* Its claims named A; the refresh produced B. */
    expect(resolution.status).toBe("unresolved");
  });

  it("a pinned request carries the verified expiry and user, never the cookie's own", async () => {
    const jar = new BrowserCookieJar();
    const a = api.generation({ sessionId: SESSION_A });
    /* Claims to expire now (so auth-js would refresh it downstream) and
       carries someone else's cached profile. */
    plant(
      jar,
      {
        ...a,
        expires_at: Math.floor(Date.now() / 1000),
        user: { id: a.user.id, email: "planted@example.com" },
      },
      "shared-domain"
    );
    plant(
      jar,
      api.generation({ sessionId: SESSION_B, expiresIn: -60, bulky: true }),
      "host-only"
    );

    const response = await middleware(request("/dashboard", jar));
    const forwarded = forwardedSession(response);

    expect(forwarded?.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 3000);
    expect((forwarded?.user as { email: string }).email).toBe("founder@example.com");
    expect(api.state.refreshCalls).toBe(0);
  });
});

describe("Codex probe 2: sign-out is complete only when every copy is accounted for", () => {
  it("a copy claiming an already signed-out user still has its own tokens revoked", async () => {
    const jar = new BrowserCookieJar();
    const mine = api.generation({ sessionId: SESSION_A, bulky: true });
    const theirs = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    /* Claims to be mine (expired JWT naming me), holds their refresh. */
    const claimsMine = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    plant(jar, mine, "shared-domain");
    plant(jar, { ...claimsMine, refresh_token: theirs.refresh_token }, "host-only");

    const response = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    /* The old shortcut marked this copy "covered" and left B live. */
    expect(api.isLive(SESSION_B)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("complete");
  });

  it("is reported incomplete when that other sign-in cannot be revoked", async () => {
    const jar = new BrowserCookieJar();
    const mine = api.generation({ sessionId: SESSION_A, bulky: true });
    const theirs = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    const claimsMine = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    plant(jar, mine, "shared-domain");
    plant(jar, { ...claimsMine, refresh_token: theirs.refresh_token }, "host-only");
    api.state.logoutFailure = (token) =>
      api.sessionOf(token) === SESSION_B ? 500 : null;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await logout(logoutRequest(jar));

    expect(api.isLive(SESSION_A)).toBe(false);
    expect(api.isLive(SESSION_B)).toBe(true);
    expect(response.headers.get("x-auth-revocation")).toBe("incomplete");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}${SESSION_RECOVERY_PATH}?status=incomplete`
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/eyJ|refresh-|fake-/);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
  });

  it("a refresh token GoTrue reports as reused leaves the result uncertain", async () => {
    const jar = new BrowserCookieJar();
    const theirs = api.generation({
      sessionId: SESSION_B,
      userId: OTHER_USER_ID,
      expiresIn: -60,
      refreshLive: false,
      consumed: true,
    });
    /* A live sibling keeps the sign-in row and its access token alive. */
    api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    plant(jar, theirs, "shared-domain");

    const report = await revokeSessionCandidates(inventoryOf(jar), config());

    expect(report.uncertain).toBe(1);
    expect(report.status).toBe("incomplete");
    expect(api.isLive(SESSION_B)).toBe(true);
  });

  it("distinguishes revoked, already-invalid and uncertain copies", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    plant(jar, revokedCopy(SESSION_C), "host-only");

    const report = await revokeSessionCandidates(inventoryOf(jar), config());

    /* Counted per credential (two tokens per copy) and per user. */
    expect(report).toMatchObject({
      status: "complete",
      candidates: 2,
      revoked: 1,
      alreadyInvalid: 3,
      uncertain: 0,
      skipped: 0,
      usersSignedOut: 1,
      usersUnconfirmed: 0,
    });
  });

  it("past the candidate budget it is never complete, and resolution concludes nothing", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    const inventory = inventoryOf(jar);
    const crowded = {
      ...inventory,
      conflict: true,
      candidates: Array.from({ length: MAX_JUDGED_CANDIDATES + 1 }, (_, index) => ({
        ...inventory.candidates[0],
        refreshToken: `copy-${index}`,
      })),
    };

    expect((await resolveSessionConflict(crowded, config())).status).toBe("unresolved");
    expect(api.state.validatedTokens).toEqual([]);
    expect(api.state.refreshCalls).toBe(0);

    const report = await revokeSessionCandidates(crowded, config());
    expect(report.skipped).toBe(1);
    expect(report.status).toBe("incomplete");
  });
});

describe("sign-out CSRF protection", () => {
  const allowed: [string, Record<string, string>][] = [
    ["same Origin, no Sec-Fetch-Site", { origin: ORIGIN }],
    ["same Origin, Sec-Fetch-Site same-origin", { origin: ORIGIN, "sec-fetch-site": "same-origin" }],
    ["no Origin, Sec-Fetch-Site same-origin", { "sec-fetch-site": "same-origin" }],
  ];
  const refused: [string, Record<string, string>][] = [
    ["neither header", {}],
    ["an Origin trusted only by X-Forwarded-Host", { origin: "https://app.example", "x-forwarded-host": "app.example" }],
    ["the right host over http", { origin: `http://${ARCHITECTA_HOST}` }],
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["a sibling-subdomain Origin", { origin: "https://evil.entrepreneuria.io" }],
    ["an opaque Origin", { origin: "null" }],
    ["a malformed Origin", { origin: "not a url" }],
    ["an Origin with a path", { origin: `${ORIGIN}/auth/logout` }],
    ["a non-http Origin", { origin: `ftp://${ARCHITECTA_HOST}` }],
    ["the right host over another port", { origin: `${ORIGIN}:8443` }],
    ["Sec-Fetch-Site cross-site alone", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site same-site alone", { "sec-fetch-site": "same-site" }],
    ["Sec-Fetch-Site none alone", { "sec-fetch-site": "none" }],
    ["same Origin contradicted by cross-site", { origin: ORIGIN, "sec-fetch-site": "cross-site" }],
    ["same-origin contradicted by a foreign Origin", { origin: "https://evil.example", "sec-fetch-site": "same-origin" }],
  ];

  for (const [label, headers] of allowed) {
    it(`allows ${label}`, () => {
      expect(
        isSameOriginRequest(
          { headers: new Headers({ host: ARCHITECTA_HOST, ...headers }) },
          new Set([ORIGIN])
        )
      ).toBe(true);
    });
  }

  for (const [label, headers] of refused) {
    it(`refuses ${label}: nothing revoked or expired`, async () => {
      const jar = new BrowserCookieJar();
      plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

      const response = await logout(
        request(LOGOUT_PATH, jar, headers, "POST")
      );

      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(api.state.logoutCalls).toBe(0);
      expect(api.isLive(SESSION_A)).toBe(true);
    });
  }

  it("GET changes nothing and forwards to the confirmation page", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

    const response = await logoutGet(
      request(`${LOGOUT_PATH}?reason=session-unresolved&next=https://evil.example/x`, jar)
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}${SESSION_RECOVERY_PATH}?reason=session-unresolved&next=%2Fdashboard`
    );
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(api.state.logoutCalls).toBe(0);
    expect(api.isLive(SESSION_A)).toBe(true);
  });

  it("GET drops a reason it does not know", async () => {
    const response = await logoutGet(
      request(`${LOGOUT_PATH}?reason=<script>`, new BrowserCookieJar())
    );

    expect(response.headers.get("location")).toBe(`${ORIGIN}${SESSION_RECOVERY_PATH}`);
  });
});

describe("unresolved conflicts: explicit recovery, never a login loop", () => {
  function unresolvedJar() {
    const jar = new BrowserCookieJar();
    /* Two expired generations: only refreshes could tell them apart. */
    plant(
      jar,
      api.generation({ sessionId: SESSION_A, expiresIn: -60, bulky: true }),
      "shared-domain"
    );
    plant(
      jar,
      api.generation({
        sessionId: SESSION_A,
        expiresIn: -120,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      }),
      "host-only"
    );
    return jar;
  }

  it("repeated requests land on the recovery page every time, changing nothing", async () => {
    const jar = unresolvedJar();
    const before = jar.header();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await middleware(request("/dashboard?tab=2", jar));

      expect(response.headers.get("location")).toBe(
        `${ORIGIN}${SESSION_RECOVERY_PATH}?reason=session-unresolved&next=%2Fdashboard%3Ftab%3D2`
      );
      expect(response.headers.get("location")).not.toMatch(/entrepreneuria\.io\/login/);
      jar.apply(response);
    }

    expect(jar.header()).toBe(before);
    expect(api.state.refreshCalls).toBe(0);
    expect(api.canRefresh(SESSION_A)).toBe(true);
  });

  it("the recovery page itself is reachable and changes nothing", async () => {
    const jar = unresolvedJar();
    const before = jar.header();

    const response = await middleware(
      request(`${SESSION_RECOVERY_PATH}?reason=session-unresolved`, jar)
    );

    expect(response.headers.get("location")).toBeNull();
    expect(sessionSetCookies(response)).toEqual([]);
    jar.apply(response);
    expect(jar.header()).toBe(before);
  });

  it("the page explains the state and offers only an explicit sign-out", async () => {
    const html = await renderPage({ reason: "session-unresolved", next: "/dashboard" });

    expect(html).toMatch(/couldn&#x27;t safely restore your session/);
    expect(html).toMatch(/every device/);
    expect(html).toContain(`<form action="${LOGOUT_PATH}" method="post">`);
    expect(html).toContain("Sign out of all devices");
    expect(html).not.toContain("Try again");
  });

  it("signing out from it ends the conflict for good", async () => {
    const jar = unresolvedJar();

    const signedOut = await logout(logoutRequest(jar));
    expect(signedOut.headers.get("x-auth-revocation")).toBe("complete");
    jar.apply(signedOut);
    expect(api.isLive(SESSION_A)).toBe(false);

    const next = await middleware(request("/dashboard", jar));
    expect(next.headers.get("location")).toMatch(/^https:\/\/entrepreneuria\.io\/login\?next=/);
  });

  for (const [label, plantSecond] of [
    ["two live identities", "identity"],
    ["an Auth API outage", "outage"],
  ] as const) {
    it(`${label} also routes protected pages to recovery, not login`, async () => {
      const jar = new BrowserCookieJar();
      plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
      if (plantSecond === "identity") {
        plant(
          jar,
          api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true }),
          "host-only"
        );
      } else {
        plant(jar, revokedCopy(SESSION_C), "host-only");
        api.state.mode = "down";
      }

      const response = await middleware(request("/dashboard", jar));
      const reason = plantSecond === "identity" ? "session-conflict" : "auth-unavailable";

      expect(response.headers.get("location")).toBe(
        `${ORIGIN}${SESSION_RECOVERY_PATH}?reason=${reason}&next=%2Fdashboard`
      );
      expect(sessionSetCookies(response)).toEqual([]);

      const html = await renderPage({ reason, next: "/dashboard" });
      if (plantSecond === "outage") {
        expect(html).toContain('href="/dashboard"');
        expect(html).toContain("Try again");

        api.state.mode = "up";
        const retried = await middleware(request("/dashboard", jar));
        expect(retried.headers.get("location")).toBeNull();
      } else {
        expect(html).toMatch(/More than one account/);
      }
    });
  }
});

describe("incomplete revocation is never shown as success", () => {
  it("lands on a page that says so, with a sign-in path to finish it and no automatic retry", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    api.state.logoutFailure = 500;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await logout(logoutRequest(jar));

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}${SESSION_RECOVERY_PATH}?status=incomplete`
    );

    const html = await renderPage({ status: "incomplete" });
    expect(html).toMatch(/couldn&#x27;t confirm/);
    expect(html).toContain("Sign in");
    expect(html).not.toContain("<form");
    expect(html).not.toMatch(/http-equiv="refresh"/i);
  });

  it("a complete sign-out still goes straight to shared sign-in", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

    const response = await logout(logoutRequest(jar));

    expect(response.headers.get("location")).toMatch(/^https:\/\/entrepreneuria\.io\/login\?next=/);
  });
});

describe("browser-to-server sign-out", () => {
  it("posts a form to the route, touching no cookie first", async () => {
    const submitted: { method: string; action: string }[] = [];
    const form = {
      method: "",
      action: "",
      style: {} as Record<string, string>,
      submit() {
        submitted.push({ method: this.method, action: this.action });
      },
    };
    const doc = {
      createElement: vi.fn(() => form),
      body: { appendChild: vi.fn() },
    } as unknown as Document;

    submitLogout(doc);

    expect(submitted).toEqual([{ method: "post", action: LOGOUT_PATH }]);
    expect(api.state.logoutCalls).toBe(0);
  });

  it("the default confirmation says it ends every device's session", async () => {
    const html = await renderPage({});

    expect(html).toContain("Sign out of all devices?");
    expect(html).toMatch(/every device you&#x27;re signed in on/);
  });
});

describe("the fake GoTrue model itself", () => {
  async function refresh(token: string) {
    const response = await api.fetchStub(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      { method: "POST", body: JSON.stringify({ refresh_token: token }) }
    );
    return { status: response.status, body: await response.json() };
  }

  async function logoutWith(token: string, scope: string) {
    return api.fetchStub(`${SUPABASE_URL}/auth/v1/logout?scope=${scope}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("rotates, then answers the parent of the active token with the active token", async () => {
    const first = api.generation({ sessionId: SESSION_A });
    vi.useFakeTimers({ toFake: ["Date"] });

    const rotated = await refresh(first.refresh_token);
    vi.setSystemTime(Date.now() + 60_000);
    const again = await refresh(first.refresh_token);

    expect(rotated.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.body.refresh_token).toBe(rotated.body.refresh_token);
    expect(api.state.reuseDetected).toBe(false);
  });

  it("issues a new child within the reuse interval", async () => {
    const first = api.generation({ sessionId: SESSION_A });
    vi.useFakeTimers({ toFake: ["Date"] });

    const second = await refresh(first.refresh_token);
    await refresh(second.body.refresh_token);
    /* `first` is now a grandparent, but was rotated moments ago. */
    const sibling = await refresh(first.refresh_token);

    expect(sibling.status).toBe(200);
    expect(sibling.body.refresh_token).not.toBe(second.body.refresh_token);
    expect(api.state.reuseDetected).toBe(false);
  });

  it("treats a grandparent presented after the reuse interval as an attack", async () => {
    const first = api.generation({ sessionId: SESSION_A });
    vi.useFakeTimers({ toFake: ["Date"] });

    const second = await refresh(first.refresh_token);
    await refresh(second.body.refresh_token);
    vi.setSystemTime(Date.now() + 60_000);
    const reused = await refresh(first.refresh_token);

    expect(reused.body.error_code).toBe("refresh_token_already_used");
    expect(api.state.reuseDetected).toBe(true);
    expect(api.canRefresh(SESSION_A)).toBe(false);
    /* Reuse revokes refresh tokens; the sign-in row and its JWTs live on. */
    expect(api.isLive(SESSION_A)).toBe(true);
  });

  it("local, others and global sign-out delete exactly their sessions", async () => {
    const a = api.generation({ sessionId: SESSION_A });
    const b = api.generation({ sessionId: SESSION_B });
    const other = api.generation({ sessionId: SESSION_C, userId: OTHER_USER_ID });

    expect((await logoutWith(a.access_token, "local")).status).toBe(204);
    expect([api.isLive(SESSION_A), api.isLive(SESSION_B)]).toEqual([false, true]);

    /* A fresh sign-in of the same user, then "others" from B. */
    api.generation({ sessionId: SESSION_A });
    expect((await logoutWith(b.access_token, "others")).status).toBe(204);
    expect([api.isLive(SESSION_A), api.isLive(SESSION_B)]).toEqual([false, true]);

    expect((await logoutWith(b.access_token, "global")).status).toBe(204);
    expect(api.isLive(SESSION_B)).toBe(false);
    /* Another user's sign-in is never touched. */
    expect(api.isLive(SESSION_C)).toBe(true);
    expect(api.sessionOf(other.access_token)).toBe(SESSION_C);
  });

  it("a revoked sign-in's JWT is refused by GoTrue but still verifies locally until it expires", async () => {
    const a = api.generation({ sessionId: SESSION_A });
    api.revokeSession(SESSION_A);

    const user = await api.fetchStub(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: `Bearer ${a.access_token}` },
    });

    expect((await user.json()).error_code).toBe("session_not_found");
    expect(api.acceptsJwtLocally(a.access_token)).toBe(true);

    afterAccessTokensExpire();
    expect(api.acceptsJwtLocally(a.access_token)).toBe(false);
  });
});
