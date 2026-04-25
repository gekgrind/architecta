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
import {
  getEcosystemCookieDomain,
  getSupabaseProjectConfig,
} from "@/lib/config/ecosystem";

const PROTECTED_PREFIXES = [
  "/analytics",
  "/brand-kit",
  "/campaigns",
  "/dashboard",
  "/generate",
  "/library",
  "/studio",
  "/app",
];

function applySharedCookieOptions(
  options: CookieOptions,
  sharedCookieDomain?: string | null
): CookieOptions {
  return {
    ...options,
    ...(sharedCookieDomain ? { domain: sharedCookieDomain } : {}),
  };
}

export async function middleware(req: NextRequest) {
  const { url, anonKey } = getSupabaseProjectConfig();
  const sharedCookieDomain = getEcosystemCookieDomain();
  const res = NextResponse.next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set(
          name,
          value,
          applySharedCookieOptions(options, sharedCookieDomain)
        );
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set(
          name,
          "",
          applySharedCookieOptions(options, sharedCookieDomain)
        );
      },
    },
  });

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
    const nextPath = req.nextUrl.toString();
    return NextResponse.redirect(new URL(buildSharedLoginHref(nextPath), req.url));
  }

  let onboardingComplete = false;
  let hasAccess = true;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    onboardingComplete = Boolean(profile?.onboarding_complete);
    hasAccess = hasArchitectaAccess(profile ?? undefined);
  }

  if (isAuthPage && user) {
    const redirectPath = getPostAuthRedirectPath(
      onboardingComplete,
      req.nextUrl.searchParams.get("next")
    );

    return NextResponse.redirect(new URL(redirectPath, req.url));
  }

  if (user && !hasAccess && isProtected) {
    return NextResponse.redirect(new URL(ACCESS_DENIED_PATH, req.url));
  }

  if (user && onboardingComplete && isOnboarding) {
    return NextResponse.redirect(new URL(APP_HOME_PATH, req.url));
  }

  const isArchitectaArea =
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/brand-kit") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/generate") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/app/architecta");

  if (user && isArchitectaArea && !isOnboarding && !onboardingComplete) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
