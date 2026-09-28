import type { CookieOptionsWithName } from "@supabase/ssr";

import { getEcosystemCookieDomain } from "@/lib/config/ecosystem";

export const ENTREPRENEURIA_AUTH_COOKIE_NAME = "entrepreneuria-auth-token";

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
  const domain = getEcosystemCookieDomain();
  const normalized = normalizeHostname(hostname);
  if (!domain || !normalized) return false;

  const bareDomain = domain.replace(/^\./, "");
  return normalized === bareDomain || normalized.endsWith(`.${bareDomain}`);
}

export function getSharedSupabaseCookieOptions(
  hostname?: string | null
): CookieOptionsWithName {
  const domain = getEcosystemCookieDomain();
  const useSharedDomain = isEntrepreneuriaHostname(hostname);

  return {
    name: ENTREPRENEURIA_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: useSharedDomain || process.env.NODE_ENV === "production",
    ...(useSharedDomain ? { domain } : {}),
  };
}

/** Browser-side variant: derives the hostname from `window.location`. */
export function getBrowserSupabaseCookieOptions(): CookieOptionsWithName {
  if (typeof window === "undefined") {
    return getSharedSupabaseCookieOptions();
  }

  return getSharedSupabaseCookieOptions(window.location.hostname);
}
