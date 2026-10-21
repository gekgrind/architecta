import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createChunks,
  stringFromBase64URL,
  stringToBase64URL,
} from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as logout } from "@/app/auth/logout/route";
import {
  AUTH_NO_STORE_HEADERS,
  findUnreadableSessionCookies,
  readAuthCookieInventory,
  retireStaleAuthCookies,
} from "@/lib/supabase/auth-cookie-cleanup";
import { middleware } from "@/middleware";
import {
  ARCHITECTA_HOST,
  BrowserCookieJar,
  SHARED_DOMAIN,
} from "@/test/browser-cookie-jar";
import {
  DEFAULT_SESSION_ID,
  KEY,
  SUPABASE_URL,
  fakeAccessToken,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "@/test/fake-auth-api";

/*
 * Architecta's own migration off host-only session cookies. A cookie that
 * is host-only to architecta.entrepreneuria.io never reaches
 * entrepreneuria.io, so Architecta has to retire it itself; these drive
 * the real middleware and logout route through a browser-like jar.
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

function request(path: string, jar: BrowserCookieJar, host = ARCHITECTA_HOST) {
  const origin = host.startsWith("localhost") ? `http://${host}` : `https://${host}`;

  return new NextRequest(`${origin}${path}`, {
    headers: {
      host,
      cookie: jar.header(new URL(path, origin).pathname, host.split(":")[0]),
    },
  });
}

/* Sign-out as the browser sends it: a same-origin form POST. */
function logoutRequest(jar: BrowserCookieJar, host = ARCHITECTA_HOST) {
  const origin = host.startsWith("localhost") ? `http://${host}` : `https://${host}`;

  return new NextRequest(`${origin}/auth/logout`, {
    method: "POST",
    headers: {
      host,
      origin,
      cookie: jar.header("/auth/logout", host.split(":")[0]),
    },
  });
}

async function browse(jar: BrowserCookieJar, path = "/dashboard") {
  const response = await middleware(request(path, jar));
  jar.apply(response);

  return response;
}

function sharedValues(jar: BrowserCookieJar) {
  return jar
    .names("shared-domain", KEY)
    .map((name) => [name, jar.get(name, "shared-domain")]);
}

function expectUncacheable(response: Response) {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    expect(response.headers.get(key), key).toBe(value);
  }
}

describe("Architecta host: migration to the canonical .entrepreneuria.io family", () => {
  it("the premise: Architecta host-only cookies never reach entrepreneuria.io", () => {
    const jar = new BrowserCookieJar();
    jar.set(`${KEY}.0`, "host-only-copy", "host-only");
    jar.set(`${KEY}.0`, "canonical", "shared-domain");

    expect(jar.header("/", ARCHITECTA_HOST)).toBe(
      `${KEY}.0=host-only-copy; ${KEY}.0=canonical`
    );
    expect(jar.header("/", SHARED_DOMAIN)).toBe(`${KEY}.0=canonical`);
  });

  it("1. a host-only session moves onto .entrepreneuria.io at its refresh", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.storedSession({ expiresIn: -60 }), "host-only");
    jar.set("unrelated-preference", "keep", "host-only");

    const response = await browse(jar);

    expect(response.headers.get("location")).toBeNull();
    expect(api.state.refreshCalls).toBe(1);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.names("shared-domain", KEY).length).toBeGreaterThan(0);
    expect(jar.get("unrelated-preference", "host-only")).toBe("keep");

    api.state.validatedTokens = [];
    const next = await browse(jar);
    expect(next.headers.get("location")).toBeNull();
    expect(next.headers.getSetCookie()).toEqual([]);
    expect(api.state.validatedTokens).toEqual([api.state.accessToken]);
  });

  it("1b. a sound host-only session is kept until then, even through an outage", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.storedSession(), "host-only");
    const before = jar.names("host-only", KEY);

    api.state.mode = "down";
    const response = await browse(jar);

    expect(response.headers.getSetCookie()).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual(before);
  });

  it("2. identical host-only and canonical copies: the host-only copy goes", async () => {
    const jar = new BrowserCookieJar();
    const session = api.storedSession();
    plant(jar, session, "host-only");
    plant(jar, session, "shared-domain");
    const canonical = sharedValues(jar);

    const response = await browse(jar);

    expect(response.headers.get("location")).toBeNull();
    /* The canonical copy is rewritten as it is, never expired. */
    for (const header of response.headers.getSetCookie()) {
      expect(/Domain=/i.test(header) && /Max-Age=0/.test(header)).toBe(false);
    }
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(sharedValues(jar)).toEqual(canonical);
    expect((await browse(jar)).headers.getSetCookie()).toEqual([]);
  });

  for (const order of ["host-only first", "canonical first"] as const) {
    it(`3. different generations converge on the canonical family (${order})`, async () => {
      const jar = new BrowserCookieJar();
      /* An earlier generation: its own access token, no longer accepted. */
      const stale = api.storedSession({
        refreshToken: "stale-refresh-token",
        expiresIn: 1800,
        token: fakeAccessToken({ expiresIn: 1800 }),
      });
      const current = api.storedSession({ bulky: false });

      if (order === "host-only first") {
        plant(jar, stale, "host-only");
        plant(jar, current, "shared-domain");
      } else {
        plant(jar, current, "shared-domain");
        plant(jar, stale, "host-only");
      }
      const canonical = sharedValues(jar);

      const before = jar.header();

      /* The current generation's access token serves the visitor. The
         other copy's refresh token cannot be ruled out without a
         refresh, so neither copy is rewritten or retired — the old
         behaviour of canonicalizing on an accepted access token alone
         adopted pairs nobody had proven. */
      const response = await browse(jar);

      expect(response.headers.get("location")).toBeNull();
      expect(api.state.refreshCalls).toBe(0);
      expect(jar.header()).toBe(before);
      expect(sharedValues(jar)).toEqual(canonical);
    });
  }

  it("4. a corrupt canonical cookie is retired in both scopes", async () => {
    for (const value of ["base64-!!corrupt!!", "base64-bm90LWpzb24", "not-json"]) {
      const jar = new BrowserCookieJar();
      jar.set(KEY, value, "shared-domain");
      jar.set("unrelated-preference", "keep", "shared-domain");

      const response = await browse(jar);

      expectUncacheable(response);
      expect(jar.names("shared-domain", KEY)).toEqual([]);
      expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
      expect((await browse(jar)).headers.getSetCookie()).toEqual([]);
    }
  });

  for (const scope of ["shared-domain", "host-only"] as const) {
    it(`5. an orphan ${scope} chunk goes, the sound canonical .0/.1 stays`, async () => {
      const jar = new BrowserCookieJar();
      plant(jar, api.storedSession(), "shared-domain");
      const canonical = sharedValues(jar);
      expect(canonical.length).toBe(2);
      jar.set(`${KEY}.2`, "stale-chunk", scope);

      const first = await browse(jar);

      expect(
        first.headers.getSetCookie().map((header) => header.split("=")[0])
      ).toEqual([`${KEY}.2`, `${KEY}.2`]);
      expect(sharedValues(jar)).toEqual(canonical);

      api.state.validatedTokens = [];
      const second = await browse(jar);
      expect(second.headers.get("location")).toBeNull();
      expect(api.state.validatedTokens).toEqual([api.state.accessToken]);
    });
  }

  it("5b. a non-contiguous .0/.2 family is retired in full", async () => {
    const jar = new BrowserCookieJar();
    const chunks = sessionChunks(api.storedSession());
    jar.set(chunks[0].name, chunks[0].value, "shared-domain");
    jar.set(`${KEY}.2`, chunks[1].value, "shared-domain");

    await browse(jar);

    expect(jar.names("shared-domain", KEY)).toEqual([]);
  });

  it("keeps a sound canonical session while the Auth API is unreachable", async () => {
    for (const outage of ["down", "unavailable"] as const) {
      const jar = new BrowserCookieJar();
      plant(jar, api.storedSession(), "shared-domain");
      const canonical = sharedValues(jar);

      api.state.mode = outage;
      const response = await browse(jar);
      api.state.mode = "up";

      expect(response.headers.getSetCookie()).toEqual([]);
      expect(sharedValues(jar)).toEqual(canonical);
    }
  });

  it("retires legacy sb-* host-only cookies and nothing unrelated", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.storedSession(), "shared-domain");
    jar.set("sb-project-ref-auth-token", "legacy", "host-only");
    jar.set("sb-refresh-token", "legacy", "host-only");
    jar.set("sb-unrelated", "keep", "host-only");
    jar.set("unrelated-preference", "keep", "host-only");

    await browse(jar);

    expect(jar.get("sb-project-ref-auth-token", "host-only")).toBeUndefined();
    expect(jar.get("sb-refresh-token", "host-only")).toBeUndefined();
    expect(jar.get("sb-unrelated", "host-only")).toBe("keep");
    expect(jar.get("unrelated-preference", "host-only")).toBe("keep");
    expect(jar.names("shared-domain", KEY).length).toBe(2);
  });

  it("repeated requests over malformed storage never grow cookies or headers", async () => {
    const jar = new BrowserCookieJar();
    jar.set(KEY, "base64-corrupt", "shared-domain");
    jar.set(`${KEY}.0`, "x", "host-only");
    jar.set(`${KEY}.9`, "y", "shared-domain");
    jar.set("unrelated-preference", "keep", "shared-domain");
    const initial = jar.size;

    const baseline = (await middleware(request("/dashboard", jar))).headers.getSetCookie();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        (await middleware(request("/dashboard", jar))).headers.getSetCookie()
      ).toEqual(baseline);
    }
    expect(baseline.length).toBeLessThanOrEqual(2 * 3);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await browse(jar);
      expect(jar.size).toBeLessThanOrEqual(initial);
    }
    expect(jar.size).toBe(1);
  });
});

describe("Architecta logout expires the session in both scopes", () => {
  it("6. host-only and .entrepreneuria.io copies, legacy cookies, nothing unrelated", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.storedSession(), "shared-domain");
    plant(jar, api.storedSession({ refreshToken: "stale" }), "host-only");
    jar.set("sb-refresh-token", "legacy", "host-only");
    jar.set("sb-project-ref-auth-token", "legacy", "shared-domain");
    jar.set("unrelated-preference", "keep", "shared-domain");
    jar.set("theme", "dark", "host-only");

    const response = await logout(logoutRequest(jar));

    /* Both copies' tokens are tried; the sign-in can no longer be used.
       The legacy `sb-*` cookies are expired too, but this code cannot
       read or revoke what they hold, so the sign-out is not reported
       as complete. */
    expect(api.isLive(DEFAULT_SESSION_ID)).toBe(false);
    expect(api.canRefresh(DEFAULT_SESSION_ID)).toBe(false);
    expect(response.headers.get("x-auth-revocation")).toBe("incomplete");
    expectUncacheable(response);
    jar.apply(response);
    expect(jar.names("shared-domain", KEY)).toEqual([]);
    expect(jar.names("host-only", KEY)).toEqual([]);
    expect(jar.names("shared-domain", "sb-")).toEqual([]);
    expect(jar.names("host-only", "sb-")).toEqual([]);
    expect(jar.get("unrelated-preference", "shared-domain")).toBe("keep");
    expect(jar.get("theme", "host-only")).toBe("dark");
  });

  it("7. every numeric chunk suffix the browser holds, whatever its number", async () => {
    const jar = new BrowserCookieJar();
    for (const suffix of ["", ".0", ".1", ".2", ".17", ".123"]) {
      jar.set(`${KEY}${suffix}`, "x", "shared-domain");
      jar.set(`${KEY}${suffix}`, "y", "host-only");
    }
    jar.set(`${KEY}-code-verifier`, "keep", "shared-domain");

    const response = await logout(logoutRequest(jar));
    jar.apply(response);

    expect(jar.names("shared-domain", KEY)).toEqual([`${KEY}-code-verifier`]);
    expect(jar.names("host-only", KEY)).toEqual([]);
  });

  it("is uncacheable even with nothing to expire", async () => {
    const response = await logout(logoutRequest(new BrowserCookieJar()));

    expectUncacheable(response);
    /* Nothing was signed out anywhere: deleting nothing locally is not
       a sign-out of every device. */
    expect(response.headers.get("x-auth-revocation")).toBe("local");
  });

  it("every browser sign-out control posts to the server route, untouched", () => {
    for (const file of [
      "components/auth/AuthNav.tsx",
      "components/layout/header.tsx",
      "components/layout/sidebar.tsx",
      "components/navigation/SidebarUserMenu.tsx",
    ]) {
      const source = readFileSync(join(__dirname, "..", "..", file), "utf8");

      /* A browser-side signOut() would revoke one generation and delete
         the canonical cookies before the route could see them all. */
      expect(source, file).not.toMatch(/\.signOut\(/);
      expect(source, file).not.toMatch(/location\.(assign\(|href\s*=).*logout/i);
      expect(source, file).toMatch(/submitLogout\(\)/);
    }
  });
});

describe("9. localhost keeps host-only auth cookies", () => {
  it("writes no Domain, retires corrupt cookies host-only, leaves sb-* alone", async () => {
    const jar = new BrowserCookieJar("localhost");
    plant(jar, api.storedSession({ expiresIn: -60 }), "host-only");
    jar.set("sb-other-project-auth-token", "other-local-app", "host-only");

    const refreshed = await middleware(request("/", jar, "localhost:3000"));
    jar.apply(refreshed, "localhost");
    for (const header of refreshed.headers.getSetCookie()) {
      expect(header).not.toMatch(/Domain=/i);
    }
    expect(jar.names("host-only", KEY).length).toBeGreaterThan(0);

    jar.set(`${KEY}.5`, "orphan", "host-only");
    const cleaned = await middleware(request("/", jar, "localhost:3000"));
    jar.apply(cleaned, "localhost");
    expect(cleaned.headers.getSetCookie()).toEqual([
      `${KEY}.5=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`,
    ]);
    expect(jar.get("sb-other-project-auth-token", "host-only")).toBe("other-local-app");

    const signedOut = await logout(logoutRequest(jar, "localhost:3000"));
    for (const header of signedOut.headers.getSetCookie()) {
      expect(header).not.toMatch(/Domain=/i);
    }
    jar.apply(signedOut, "localhost");
    expect(jar.names("host-only", KEY)).toEqual([]);
  });
});

describe("10. production Architecta host", () => {
  it("writes the refreshed session to .entrepreneuria.io, Secure, SameSite=Lax, Path=/", async () => {
    const jar = new BrowserCookieJar();
    plant(jar, api.storedSession({ expiresIn: -60 }), "shared-domain");

    const response = await middleware(request("/", jar));
    const writes = response.headers
      .getSetCookie()
      .filter((header) => header.startsWith(KEY) && !/Max-Age=0/.test(header));

    expect(writes.length).toBeGreaterThan(0);
    for (const header of writes) {
      expect(header).toMatch(/Domain=\.entrepreneuria\.io/i);
      expect(header).toMatch(/Path=\//);
      expect(header).toMatch(/Secure/);
      expect(header).toMatch(/SameSite=lax/i);
    }
  });
});

describe("structural analysis", () => {
  const [chunk0, chunk1] = sessionChunks(installFakeAuthApi().storedSession());

  it("a sound session has nothing unreadable", () => {
    expect(
      findUnreadableSessionCookies(
        new Map([
          [chunk0.name, chunk0.value],
          [chunk1.name, chunk1.value],
        ])
      )
    ).toEqual([]);
  });

  it("is not judged when two scopes of a name coexist", () => {
    const inventory = readAuthCookieInventory({
      headers: new Headers({
        host: ARCHITECTA_HOST,
        cookie: `${KEY}.0=a; ${KEY}.0=b`,
      }),
    });

    expect(inventory.duplicated).toBe(true);
    expect(inventory.unreadable).toEqual([]);
  });

  it("never expires a name + scope the response is writing", () => {
    const response = NextResponse.next();
    response.cookies.set(`${KEY}.0`, "fresh", {
      domain: ".entrepreneuria.io",
      path: "/",
    });
    retireStaleAuthCookies(
      readAuthCookieInventory({
        headers: new Headers({ host: ARCHITECTA_HOST, cookie: `${KEY}.0=garbage` }),
      }),
      response
    );

    const headers = response.headers.getSetCookie();
    expect(headers.filter((header) => header.startsWith(`${KEY}.0=fresh;`))).toHaveLength(1);
    expect(
      headers.some((header) => /Max-Age=0/.test(header) && /Domain=/i.test(header))
    ).toBe(false);
  });
});

describe("session candidates", () => {
  function inventoryFor(chunks: { name: string; value: string }[]) {
    return readAuthCookieInventory({
      headers: new Headers({
        host: ARCHITECTA_HOST,
        cookie: chunks.map(({ name, value }) => `${name}=${value}`).join("; "),
      }),
    });
  }

  /* A session whose JWT names its user and sign-in, as GoTrue's do. */
  function signedSession({
    sub = "user-a",
    sessionId = "sign-in-1",
    refreshToken = "refresh-1",
    profileFirst = false,
  } = {}) {
    const claims = stringToBase64URL(
      JSON.stringify({ sub, session_id: sessionId })
    );
    const user = profileFirst
      ? { bio: "x".repeat(3000), id: sub }
      : { id: sub, bio: "x".repeat(3000) };

    return createChunks(
      KEY,
      `base64-${stringToBase64URL(
        JSON.stringify({
          access_token: `header.${claims}.signature`,
          refresh_token: refreshToken,
          expires_at: 4102444800,
          user,
        })
      )}`
    );
  }

  it("one session copied byte for byte into both scopes is one session, not a conflict", () => {
    const session = signedSession();
    const inventory = inventoryFor([...session, ...session]);

    expect(inventory.candidates).toHaveLength(1);
    expect(inventory.duplicated).toBe(true);
    expect(inventory.identicalDuplicates).toBe(true);
    /* Dropping either copy loses nothing, so no resolution is needed. */
    expect(inventory.conflict).toBe(false);
  });

  it("a name sent twice with different values is a conflict", () => {
    const session = signedSession();
    const inventory = inventoryFor([
      ...session,
      { name: session[0].name, value: `${session[0].value}x` },
    ]);

    expect(inventory.identicalDuplicates).toBe(false);
    expect(inventory.conflict).toBe(true);
  });

  it("assembles each family on its own, though a stitched chain also decodes", () => {
    const a = signedSession();
    const b = signedSession({ refreshToken: "refresh-2" });
    /* The chunk boundary falls inside content both share. */
    expect(inventoryFor([a[0], b[1]]).candidates).toHaveLength(1);

    const inventory = inventoryFor([...a, ...b]);

    expect(inventory.candidates.map(({ cookies }) => cookies)).toEqual([a, b]);
    expect(inventory.candidates.map(({ sessionId }) => sessionId)).toEqual([
      "sign-in-1",
      "sign-in-1",
    ]);
  });

  it("never grafts another user's cached profile onto a token", () => {
    const a = signedSession({ sub: "user-a", profileFirst: true });
    const b = signedSession({ sub: "user-b", profileFirst: true });
    /* The stitched chain does decode: user-a's tokens, user-b's profile. */
    const stitched = JSON.parse(
      stringFromBase64URL((a[0].value + b[1].value).slice("base64-".length))
    );
    expect(stitched.user.id).toBe("user-b");

    expect(inventoryFor([a[0], b[1]]).candidates).toEqual([]);
    expect(
      inventoryFor([...a, ...b]).candidates.map(({ cookies }) => cookies)
    ).toEqual([a, b]);
  });

  it("a bare cookie beside another session's chunks is a conflict with no duplicate name", () => {
    const bare = createChunks(
      KEY,
      `base64-${stringToBase64URL(
        JSON.stringify({
          access_token: "bare-access-token",
          refresh_token: "bare-refresh-token",
          expires_at: 4102444800,
        })
      )}`
    );
    const inventory = inventoryFor([...bare, ...signedSession()]);

    expect(inventory.duplicated).toBe(false);
    expect(inventory.candidates).toHaveLength(2);
    expect(inventory.conflict).toBe(true);
  });

  it("gives up past a bounded number of combinations", () => {
    const inventory = inventoryFor(
      Array.from({ length: 80 }, (_, index) => ({
        name: `${KEY}.0`,
        value: `junk-${index}`,
      }))
    );

    expect(inventory.candidatesTruncated).toBe(true);
    expect(inventory.candidates).toEqual([]);
  });
});
