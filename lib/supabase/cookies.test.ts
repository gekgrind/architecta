import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  ENTREPRENEURIA_AUTH_COOKIE_NAME,
  getSharedSupabaseCookieOptions,
  mergeSharedSupabaseCookieOptions,
} from "@/lib/supabase/cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared Supabase auth cookie contract", () => {
  it("writes each session chunk under its own name, never the bare storage key", () => {
    const shared = getSharedSupabaseCookieOptions("architecta.entrepreneuria.io");
    const response = NextResponse.next();

    for (const name of [
      `${ENTREPRENEURIA_AUTH_COOKIE_NAME}.0`,
      `${ENTREPRENEURIA_AUTH_COOKIE_NAME}.1`,
    ]) {
      response.cookies.set(
        name,
        "chunk",
        mergeSharedSupabaseCookieOptions(shared, { maxAge: 10 })
      );
    }

    const written = response.headers
      .getSetCookie()
      .map((header) => header.split("=")[0]);

    expect(written).toEqual([
      `${ENTREPRENEURIA_AUTH_COOKIE_NAME}.0`,
      `${ENTREPRENEURIA_AUTH_COOKIE_NAME}.1`,
    ]);
    expect("name" in mergeSharedSupabaseCookieOptions(shared, {})).toBe(false);
  });

  it("scope attributes override the per-write options", () => {
    const merged = mergeSharedSupabaseCookieOptions(
      getSharedSupabaseCookieOptions("architecta.entrepreneuria.io"),
      { domain: undefined, path: "/app", sameSite: "none", maxAge: 10 }
    );

    expect(merged).toMatchObject({
      domain: ".entrepreneuria.io",
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 10,
    });
  });

  it("uses .entrepreneuria.io on ecosystem hosts even without the env var", () => {
    vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN", "");

    expect(
      getSharedSupabaseCookieOptions("architecta.entrepreneuria.io").domain
    ).toBe(".entrepreneuria.io");
  });

  it("stays host-only for local development", () => {
    vi.stubEnv("NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN", "");

    expect(getSharedSupabaseCookieOptions("localhost:3000").domain).toBeUndefined();
    expect(getSharedSupabaseCookieOptions(null).domain).toBeUndefined();
  });
});
