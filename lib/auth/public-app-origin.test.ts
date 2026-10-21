import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Under `next start` behind nginx a route handler's `request.url` is the
 * bind address. Every redirect a route builds, and the sign-out origin
 * check, must use the public origin instead — and never localhost in
 * production.
 */

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  onboardingComplete: true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
  })),
}));

vi.mock("@/lib/onboarding/server", () => ({
  getArchitectaOnboardingStatus: vi.fn(async () => ({
    onboardingComplete: h.onboardingComplete,
  })),
}));

import { GET as callback } from "@/app/auth/callback/route";
import { GET as logoutGet, POST as logout } from "@/app/auth/logout/route";
import { SESSION_RECOVERY_PATH } from "@/lib/auth/redirects";
import {
  CANONICAL_APP_ORIGIN,
  getPublicAppOrigin,
  getTrustedAppOrigins,
} from "@/lib/auth/same-origin";

const BIND = "http://localhost:3000";
const PUBLIC = "https://architecta.entrepreneuria.io";
const SHARED_LOGIN = "https://entrepreneuria.io/login";

function bindRequest(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${BIND}${path}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3000", ...init.headers },
  });
}

const location = (response: Response) => response.headers.get("location") ?? "";

function expectNoLoopback(response: Response) {
  expect(location(response)).not.toMatch(/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/);
}

beforeEach(() => {
  h.user = null;
  h.onboardingComplete = true;
  /* No Auth API configuration: logout judges nothing and reports
     `local` (no cookies) — enough to observe where it redirects. */
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_APP_URL", "https://entrepreneuria.io");
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL", "https://entrepreneuria.io");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://entrepreneuria.io");
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("getPublicAppOrigin", () => {
  const request = { nextUrl: new URL(`${BIND}/x`) };

  it("prefers the configured app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", `${PUBLIC}/`);
    expect(getPublicAppOrigin(request)).toBe(PUBLIC);
  });

  it("falls back to the canonical origin in production, never the bind address", () => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", "");
    expect(getPublicAppOrigin(request)).toBe(CANONICAL_APP_ORIGIN);
    expect([...getTrustedAppOrigins(request)]).toEqual([CANONICAL_APP_ORIGIN]);
  });

  it("uses the request's own origin in local development", () => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getPublicAppOrigin(request)).toBe(BIND);
    expect(getTrustedAppOrigins(request).has(BIND)).toBe(true);
  });
});

describe("route redirects behind the bind address (configured app URL)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", PUBLIC);
  });

  it("unauthenticated callback goes to the shared Entrepreneuria login", async () => {
    const response = await callback(new Request(`${BIND}/auth/callback?next=%2Fcalendar`));

    expect(location(response).startsWith(`${SHARED_LOGIN}?`)).toBe(true);
    expectNoLoopback(response);
  });

  it("authenticated callback lands on the Architecta origin", async () => {
    h.user = { id: "user-1" };

    const response = await callback(new Request(`${BIND}/auth/callback?next=%2Fcalendar`));

    expect(location(response)).toBe(`${PUBLIC}/calendar`);
  });

  it("authenticated, not yet onboarded callback goes to Architecta onboarding", async () => {
    h.user = { id: "user-1" };
    h.onboardingComplete = false;

    const response = await callback(new Request(`${BIND}/auth/callback`));

    expect(location(response)).toBe(`${PUBLIC}/onboarding`);
  });

  it("a backslash destination cannot leave the site", async () => {
    h.user = { id: "user-1" };

    const response = await callback(
      new Request(`${BIND}/auth/callback?next=%2F%5Cevil.example`)
    );

    expect(new URL(location(response)).origin).toBe(PUBLIC);
  });

  it("logout GET forwards to the confirmation page on the public origin", async () => {
    const response = logoutGet(bindRequest("/auth/logout?reason=session-unresolved"));

    expect(location(response)).toBe(
      `${PUBLIC}${SESSION_RECOVERY_PATH}?reason=session-unresolved`
    );
  });

  it("logout POST from the site lands on the public origin", async () => {
    const response = await logout(
      bindRequest("/auth/logout", { method: "POST", headers: { origin: PUBLIC } })
    );

    expect(response.status).toBe(303);
    expect(location(response)).toBe(`${PUBLIC}${SESSION_RECOVERY_PATH}?status=local`);
  });
});

describe("logout with no configured app URL in production", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", "");
  });

  it("accepts a POST from the canonical site", async () => {
    const response = await logout(
      bindRequest("/auth/logout", { method: "POST", headers: { origin: CANONICAL_APP_ORIGIN } })
    );

    expect(response.status).toBe(303);
    expect(location(response)).toBe(
      `${CANONICAL_APP_ORIGIN}${SESSION_RECOVERY_PATH}?status=local`
    );
  });

  it("refuses a POST from a foreign origin", async () => {
    const response = await logout(
      bindRequest("/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } })
    );

    expect(response.status).toBe(403);
  });

  it("refuses a POST that only names the bind address", async () => {
    const response = await logout(
      bindRequest("/auth/logout", { method: "POST", headers: { origin: BIND } })
    );

    expect(response.status).toBe(403);
  });

  it("logout GET uses the canonical origin", () => {
    const response = logoutGet(bindRequest("/auth/logout"));

    expect(location(response)).toBe(`${CANONICAL_APP_ORIGIN}${SESSION_RECOVERY_PATH}`);
  });
});

describe("local development", () => {
  it("keeps redirects on the loopback origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_ARCHITECTA_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    h.user = { id: "user-1" };

    const response = await callback(new Request(`${BIND}/auth/callback?next=%2Fcalendar`));

    expect(location(response)).toBe(`${BIND}/calendar`);
  });
});
