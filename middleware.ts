import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_DENIED_PATH,
  APP_HOME_PATH,
  LOGIN_PATH,
  ONBOARDING_PATH,
  SIGNUP_PATH,
  buildSharedLoginHref,
  getPostAuthRedirectPath,
} from "@/lib/auth/redirects";
import { hasArchitectaAccess } from "@/lib/auth/profile";
import { fetchArchitectaOnboardingComplete } from "@/lib/onboarding/gate";
import { getSupabaseProjectConfig } from "@/lib/config/ecosystem";
import {
  getSharedSupabaseCookieOptions,
  mergeSharedSupabaseCookieOptions,
} from "@/lib/supabase/cookies";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PROTECTED_PREFIXES = [
  "/analytics",
  "/brand-kit",
  "/campaigns",
  "/content-architect",
  "/content-strategy",
  "/dashboard",
  "/generate",
  "/library",
  "/calendar",
  "/seo",
  "/settings",
  "/strategy-engine",
  "/studio",
  "/app",
];

export async function middleware(req: NextRequest) {
  const { url, anonKey } = getSupabaseProjectConfig();
  const sharedCookieOptions = getSharedSupabaseCookieOptions(
    req.headers.get("host")
  );
  const sessionCookies: CookieToSet[] = [];

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: sharedCookieOptions,
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        sessionCookies.push(...cookiesToSet);
      },
    },
  });

  /*
   * Every response leaves through here, redirects included. A refresh
   * inside getUser() has already spent the old refresh token, so a
   * response that drops the rotated chunks (or the deletions of a revoked
   * session) leaves the browser replaying a used token.
   */
  function withSessionUpdates(response: NextResponse) {
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set(
        name,
        value,
        mergeSharedSupabaseCookieOptions(sharedCookieOptions, options)
      );
    }

    return response;
  }

  function redirectTo(path: string) {
    return withSessionUpdates(NextResponse.redirect(new URL(path, req.url)));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isAuthPage = pathname === LOGIN_PATH || pathname === SIGNUP_PATH;
  const isOnboarding =
    pathname === ONBOARDING_PATH ||
    pathname.startsWith(`${ONBOARDING_PATH}/`);

  if (isProtected && !user) {
    const nextPath = `${pathname}${req.nextUrl.search}`;
    return redirectTo(buildSharedLoginHref(nextPath));
  }

  let onboardingComplete = false;
  let hasAccess = true;

  if (user) {
    // Onboarding completion comes from Architecta's own onboarding session,
    // not the shared profiles.onboarding_complete (Entrepreneuria) flag.
    const [{ data: profile }, architectaOnboardingComplete] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      fetchArchitectaOnboardingComplete(supabase, user.id),
    ]);

    onboardingComplete = architectaOnboardingComplete;
    hasAccess = hasArchitectaAccess(profile ?? undefined);
  }

  if (isAuthPage && user) {
    const redirectPath = getPostAuthRedirectPath(
      onboardingComplete,
      req.nextUrl.searchParams.get("next")
    );

    return redirectTo(redirectPath);
  }

  if (user && !hasAccess && isProtected) {
    return redirectTo(ACCESS_DENIED_PATH);
  }

  if (user && onboardingComplete && isOnboarding) {
    const isDevPreview =
      process.env.NODE_ENV === "development" &&
      pathname.startsWith("/onboarding/preview");
    if (!isDevPreview) {
      return redirectTo(APP_HOME_PATH);
    }
  }

  const isArchitectaArea =
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/brand-kit") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/content-architect") ||
    pathname.startsWith("/content-strategy") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/generate") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/seo") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/strategy-engine") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/app/architecta");

  if (user && isArchitectaArea && !isOnboarding && !onboardingComplete) {
    return redirectTo(ONBOARDING_PATH);
  }

  return withSessionUpdates(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
