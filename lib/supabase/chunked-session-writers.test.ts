import { createServerClient } from "@supabase/ssr";
import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_SESSION_STATUS } from "@/lib/onboarding/gate";
import {
  ENTREPRENEURIA_AUTH_COOKIE_NAME,
  mergeSharedSupabaseCookieOptions,
} from "@/lib/supabase/cookies";

/*
 * Regression for the shared-session corruption: Architecta's cookie writers
 * spread the storage-key `name` into every per-chunk write, and Next's
 * `cookies.set(name, value, options)` lets `options.name` win, so a refresh
 * that rotated a chunked session wrote every chunk to the bare key. These
 * tests drive a real `@supabase/ssr` refresh through both writers and read
 * the result back the way every other ecosystem app does.
 */

const supabaseUrl = "https://chunk-regression.supabase.co";
const userId = "6b7c8f0e-2f43-4c6d-9a51-3e0d2a7b9c11";
const KEY = ENTREPRENEURIA_AUTH_COOKIE_NAME;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function session(tag: string, padding: number, expiresIn: number) {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp, role: "authenticated", tag })}.sig`,
    refresh_token: `refresh-${tag}`,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: exp,
    user: { id: userId, aud: "authenticated", role: "authenticated", email: "owner@example.com", app_metadata: {}, user_metadata: { padding: "x".repeat(padding) } },
  };
}

/** Splits a session the way @supabase/ssr stores it (base64url value, 3180-char chunks). */
function storedCookies(value: ReturnType<typeof session>) {
  const encoded = `base64-${encode(value)}`;
  if (encoded.length <= 3180) return [{ name: KEY, value: encoded }];
  const chunks: { name: string; value: string }[] = [];
  for (let i = 0; i * 3180 < encoded.length; i++) {
    chunks.push({ name: `${KEY}.${i}`, value: encoded.slice(i * 3180, (i + 1) * 3180) });
  }
  return chunks;
}

/** Applies Set-Cookie headers to the browser's jar: a Max-Age=0 write removes the cookie. */
function applySetCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const name = pair.slice(0, pair.indexOf("="));
    const value = decodeURIComponent(pair.slice(pair.indexOf("=") + 1));
    if (/;\s*Max-Age=0(;|$)/i.test(header) || value === "") jar.delete(name);
    else jar.set(name, value);
  }
  return jar;
}

/** Reads the shared session as Entrepreneuria, Prospra and Channelwright do: @supabase/ssr by storage key. */
async function readAsSiblingApp(jar: Map<string, string>) {
  const reader = createServerClient(supabaseUrl, "anon", {
    cookieOptions: { name: KEY },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: () => {} },
  });
  // getSession warns that cookie data is unauthenticated; decoding it is exactly what is under test.
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { data } = await reader.auth.getSession();
  const read = data.session && { access_token: data.session.access_token, userId: data.session.user.id };
  warn.mockRestore();
  return read;
}

function stubProvider(
  rotated: ReturnType<typeof session>,
  rows: { profile?: Record<string, unknown>; onboardingStatus?: string } = {}
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/v1/token?grant_type=refresh_token")) return Response.json(rotated);
    if (url.includes("/auth/v1/user")) return Response.json(rotated.user);
    if (url.includes("/rest/v1/profiles")) return Response.json(rows.profile ?? null);
    if (url.includes("/rest/v1/onboarding_sessions")) return Response.json(rows.onboardingStatus ? { status: rows.onboardingStatus } : null);
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN", ".entrepreneuria.io");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock("next/headers");
  vi.resetModules();
});

// prior → rotated chunk counts: grow from one cookie, keep two, shrink from three (stale `.2` must be deleted as `.2`).
const shapes = [
  { label: "single → chunked", priorPadding: 0, rotatedPadding: 4000 },
  { label: "chunked → chunked", priorPadding: 4000, rotatedPadding: 4200 },
  { label: "three chunks → two", priorPadding: 7000, rotatedPadding: 4000 },
];

describe.each([
  {
    writer: "middleware",
    async refresh(incoming: { name: string; value: string }[]) {
      const { middleware } = await import("@/middleware");
      const request = new NextRequest("https://architecta.entrepreneuria.io/", {
        headers: { host: "architecta.entrepreneuria.io", cookie: incoming.map(({ name, value }) => `${name}=${value}`).join("; ") },
      });
      const response = await middleware(request);
      return response.headers.getSetCookie();
    },
  },
  {
    writer: "server client",
    async refresh(incoming: { name: string; value: string }[]) {
      // Next's request cookie store writes through ResponseCookies, whose
      // set(name, value, options) lets options.name override name.
      const written = new ResponseCookies(new Headers());
      vi.doMock("next/headers", () => ({
        cookies: async () => ({ getAll: () => incoming, set: (...args: Parameters<ResponseCookies["set"]>) => written.set(...args) }),
        headers: async () => new Headers({ host: "architecta.entrepreneuria.io" }),
      }));
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      await (await createSupabaseServerClient()).auth.getUser();
      return written.getAll().map(stringify);
    },
  },
])("$writer refresh of a shared session", ({ refresh }) => {
  it.each(shapes)("$label keeps every chunk under its own name", async ({ priorPadding, rotatedPadding }) => {
    const prior = storedCookies(session("prior", priorPadding, -60));
    const rotated = session("rotated", rotatedPadding, 3600);
    const fetchMock = stubProvider(rotated);

    const setCookies = await refresh(prior);

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("grant_type=refresh_token"))).toBe(true);
    const expected = storedCookies(rotated);
    expect(expected.length).toBeGreaterThan(1);
    for (const { name, value } of expected) {
      const write = setCookies.find((header) => header.startsWith(`${name}=`));
      expect(write, name).toBeDefined();
      expect(decodeURIComponent(write!.slice(name.length + 1).split(";")[0])).toBe(value);
      expect(write).toMatch(/Domain=\.entrepreneuria\.io/i);
    }
    // The bare key is only ever cleared next to chunks, never written with a chunk's value.
    for (const header of setCookies.filter((h) => h.startsWith(`${KEY}=`))) expect(header).toMatch(/Max-Age=0/i);

    const jar = applySetCookies(new Map(prior.map(({ name, value }) => [name, value])), setCookies);
    expect([...jar.keys()].sort()).toEqual(expected.map(({ name }) => name).sort());
    const read = await readAsSiblingApp(jar);
    expect(read?.access_token).toBe(rotated.access_token);
    expect(read?.userId).toBe(userId);
  });
});

async function middlewareResponse(path: string, incoming: { name: string; value: string }[]) {
  const { middleware } = await import("@/middleware");
  return middleware(
    new NextRequest(`https://architecta.entrepreneuria.io${path}`, {
      headers: { host: "architecta.entrepreneuria.io", cookie: incoming.map(({ name, value }) => `${name}=${value}`).join("; ") },
    })
  );
}

// A refresh inside getUser() has already spent the old refresh token, so every redirect must carry the rotation.
describe("middleware redirects after a refresh", () => {
  it.each([
    { label: "signed-in visit to the login page", path: "/auth/login", rows: {} },
    { label: "protected page without Architecta access", path: "/dashboard", rows: { profile: { id: userId, architecta_access: false } } },
    { label: "onboarding page after onboarding is complete", path: "/onboarding", rows: { onboardingStatus: ONBOARDING_SESSION_STATUS.completed } },
    { label: "Architecta area before onboarding is complete", path: "/dashboard", rows: {} },
  ])("$label carries the rotated chunks", async ({ path, rows }) => {
    const prior = storedCookies(session("prior", 7000, -60));
    const rotated = session("rotated", 4000, 3600);
    stubProvider(rotated, rows);

    const response = await middlewareResponse(path, prior);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const jar = applySetCookies(new Map(prior.map(({ name, value }) => [name, value])), response.headers.getSetCookie());
    expect([...jar.keys()].sort()).toEqual(storedCookies(rotated).map(({ name }) => name).sort());
    expect((await readAsSiblingApp(jar))?.access_token).toBe(rotated.access_token);
  });

  it("carries the deletions of a revoked session onto the login redirect", async () => {
    const prior = storedCookies(session("prior", 4000, -60));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("grant_type=refresh_token")) {
        return Response.json({ code: "refresh_token_not_found", msg: "Invalid Refresh Token" }, { status: 400 });
      }
      throw new Error(`unexpected request ${String(input)}`);
    }));

    const response = await middlewareResponse("/dashboard", prior);

    // Signed out on a protected page: sent to the shared login.
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).not.toContain("/dashboard");
    const jar = applySetCookies(new Map(prior.map(({ name, value }) => [name, value])), response.headers.getSetCookie());
    expect([...jar.keys()]).toEqual([]);
  });
});

function stringify(cookie: ReturnType<ResponseCookies["getAll"]>[number]) {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
  if (cookie.path) parts.push(`Path=${cookie.path}`);
  if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  return parts.join("; ");
}

describe("mergeSharedSupabaseCookieOptions", () => {
  it("drops the storage-key name and lets the shared scope win", () => {
    const merged = mergeSharedSupabaseCookieOptions(
      { name: KEY, path: "/", sameSite: "lax", secure: true, domain: ".entrepreneuria.io" },
      { path: "/other", maxAge: 0, httpOnly: false }
    );
    expect(merged).toEqual({ path: "/", sameSite: "lax", secure: true, domain: ".entrepreneuria.io", maxAge: 0, httpOnly: false });
    expect(merged).not.toHaveProperty("name");
  });
});
