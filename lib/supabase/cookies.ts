import type { CookieOptionsWithName } from "@supabase/ssr";

import { getEcosystemCookieDomain } from "@/lib/config/ecosystem";

export const ENTREPRENEURIA_AUTH_COOKIE_NAME = "entrepreneuria-auth-token";

export function getSharedSupabaseCookieOptions(): CookieOptionsWithName {
  const domain = getEcosystemCookieDomain();

  return {
    name: ENTREPRENEURIA_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  };
}
