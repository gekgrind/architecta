import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";

import { getEcosystemCookieDomain } from "@/lib/config/ecosystem";

export const ENTREPRENEURIA_AUTH_COOKIE_NAME = "entrepreneuria-auth-token";

/*
 * The shared SSO scope is the ecosystem contract, not an optional
 * setting: without it Architecta wrote host-only copies of the shared
 * session beside the `.entrepreneuria.io` copies every other app writes,
 * and the browser sent both. The env var can still override it.
 */
const SHARED_AUTH_COOKIE_DOMAIN = ".entrepreneuria.io";

function getSharedCookieDomain() {
  return getEcosystemCookieDomain() ?? SHARED_AUTH_COOKIE_DOMAIN;
}

function normalizeHostname(hostname?: string | null) {
  return hostname?.split(":")[0]?.toLowerCase() ?? null;
}

/**
 * True only when `hostname` is actually on the shared ecosystem domain. A
 * cookie's `Domain` attribute is a browser-enforced allow-list, not a hint:
 * `Set-Cookie: Domain=.entrepreneuria.io` from a response served on
 * `localhost` (or any other host) is rejected outright, and a session cookie
 * that never gets set never gets read back by middleware. This mirrors the
 * hostname gate `entrepreneuria`'s own `lib/supabase/cookie-options.ts`
 * already applies, so local dev on either app behaves the same way.
 */
export function isEntrepreneuriaHostname(hostname?: string | null) {
  const domain = getSharedCookieDomain();
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;

  const bareDomain = domain.replace(/^\./, "");
  return normalized === bareDomain || normalized.endsWith(`.${bareDomain}`);
}

export function getSharedSupabaseCookieOptions(
  hostname?: string | null
): CookieOptionsWithName {
  const domain = getSharedCookieDomain();
  const useSharedDomain = isEntrepreneuriaHostname(hostname);

  return {
    name: ENTREPRENEURIA_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: useSharedDomain || process.env.NODE_ENV === "production",
    ...(useSharedDomain ? { domain } : {}),
  };
}

/**
 * Options for one Set-Cookie write of a session chunk. The storage-key
 * `name` must never reach a cookie setter: Next's
 * `cookies.set(name, value, options)` spreads `options` over `name`, so a
 * leaked `name` renamed every chunk (`entrepreneuria-auth-token.0`, `.1`,
 * …) and every stale-chunk deletion to the bare key. The browser kept a
 * single fragment under `entrepreneuria-auth-token`, which every app reads
 * before the chunks, so the shared session decoded to invalid JSON
 * ecosystem-wide. Scope attributes still override the per-write options.
 */
export function mergeSharedSupabaseCookieOptions(
  sharedOptions: CookieOptionsWithName,
  options: CookieOptions
): CookieOptions {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name: _storageKey, ...scope } = sharedOptions;

  return { ...options, ...scope };
}

/** Browser-side variant: derives the hostname from `window.location`. */
export function getBrowserSupabaseCookieOptions(): CookieOptionsWithName {
  if (typeof window === "undefined") {
    return getSharedSupabaseCookieOptions();
  }

  return getSharedSupabaseCookieOptions(window.location.hostname);
}
