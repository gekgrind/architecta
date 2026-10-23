import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_DENIED_PATH,
  APP_HOME_PATH,
  LOGIN_PATH,
  LOGOUT_PATH,
  ONBOARDING_PATH,
  SIGNUP_PATH,
  buildSessionRecoveryHref,
  buildSharedLoginHref,
  getPostAuthRedirectPath,
} from "@/lib/auth/redirects";
import { hasArchitectaAccess } from "@/lib/auth/profile";
import { fetchArchitectaOnboardingComplete } from "@/lib/onboarding/gate";
import { getSupabaseProjectConfig } from "@/lib/config/ecosystem";
import {
  AUTH_NO_STORE_HEADERS,
  applyAuthResponseHeaders,
  readAuthCookieInventory,
  retireStaleAuthCookies,
  settleSessionConflict,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  pinResolvedSession,
  resolveSessionConflict,
} from "@/lib/supabase/auth-session-resolution";
import {
  getSharedSupabaseCookieOptions,
  mergeSharedSupabaseCookieOptions,
} from "@/lib/supabase/cookies";

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

type CookieToSet = { name: string; value: string; options: CookieOptions };

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getSupabaseConfigOrNull() {
  try {
    return getSupabaseProjectConfig();
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  /* Logout owns its response: a session refreshed here would be written
     beside the route's expiries and could outlive the sign-out. */
  if (pathname === LOGOUT_PATH) {
    return NextResponse.next();
  }

  const isProtected = isProtectedPath(pathname);
  const supabaseConfig = getSupabaseConfigOrNull();

  /* Without Supabase configuration no session can be verified: protected
     routes fail closed, public ones stay reachable. */
  if (!supabaseConfig) {
    if (!isProtected) return NextResponse.next();

    return new NextResponse("Authentication is unavailable.", {
      status: 503,
      headers: { ...AUTH_NO_STORE_HEADERS, "Retry-After": "30" },
    });
  }

  const { url, anonKey } = supabaseConfig;
  /* Taken from the raw Cookie header before the client below runs. */
  const authCookies = readAuthCookieInventory(req);
  const sharedCookieOptions = getSharedSupabaseCookieOptions(
    authCookies.cookieHostname
  );
  const sessionCookies: CookieToSet[] = [];
  let sessionHeaders: Record<string, string> = {};

  /* Two session generations: settle which one is live before any client
     reads the collapsed cookies (see auth-session-resolution). The
     forwarded request carries the survivor only; the response rewrites
     it in the canonical scope only once every other copy is settled. */
  const resolution = authCookies.conflict
    ? await resolveSessionConflict(authCookies, {
        supabaseUrl: url,
        supabaseKey: anonKey,
        cookieOptions: sharedCookieOptions,
      })
    : null;

  if (resolution) {
    pinResolvedSession(req.cookies, authCookies, resolution);

    if (resolution.status === "live") {
      sessionCookies.push(...resolution.cookies);
      sessionHeaders = { ...resolution.headers };
    }
  }

  /* With an unsettled conflict the cookies stay exactly as they are:
     a write of the client below would replace whichever canonical copy
     was never proven dead. */
  const writable = !resolution || resolution.status === "live";

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: sharedCookieOptions,
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        if (!writable) return;

        sessionCookies.push(...cookiesToSet);
        sessionHeaders = { ...sessionHeaders, ...headersToSet };
      },
    },
  });

  /*
   * Every response leaves through here, redirects included. Session
   * writes are collected above rather than set on one response object,
   * because a redirect built afterwards would otherwise drop them: the
   * refreshed chunks, the deletions of a revoked session, and Supabase's
   * anti-cache headers. Cleanup runs last, after every cookie write.
   */
  function withSessionUpdates(response: NextResponse) {
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set(
        name,
        value,
        mergeSharedSupabaseCookieOptions(sharedCookieOptions, options)
      );
    }

    applyAuthResponseHeaders(response, sessionHeaders);

    if (resolution) {
      settleSessionConflict(authCookies, resolution.status, response);
    } else {
      retireStaleAuthCookies(authCookies, response);
    }

    return response;
  }

  function redirectTo(path: string) {
    return withSessionUpdates(NextResponse.redirect(new URL(path, req.url)));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === LOGIN_PATH || pathname === SIGNUP_PATH;
  const isOnboarding =
    pathname === ONBOARDING_PATH ||
    pathname.startsWith(`${ONBOARDING_PATH}/`);

  /* A conflict that could not be settled: no account was chosen for the
     visitor, and the copies were left as they are. Shared sign-in would
     not help — it sees the canonical copy and sends the visitor straight
     back — so the visitor goes to an explicit recovery page instead,
     which retries or signs out only when asked. */
  const recoveryReason =
    resolution?.status === "ambiguous"
      ? "session-conflict"
      : resolution?.status === "unresolved"
        ? "session-unresolved"
        : resolution?.status === "unverifiable"
          ? "auth-unavailable"
          : null;

  if (isProtected && !user && recoveryReason) {
    return redirectTo(
      buildSessionRecoveryHref(
        recoveryReason,
        `${pathname}${req.nextUrl.search}`
      )
    );
  }

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

  /* A settled conflict changed which session the request carries; pass
     that on so Server Components and route handlers read the same one. */
  return withSessionUpdates(
    resolution
      ? NextResponse.next({ request: { headers: req.headers } })
      : NextResponse.next()
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
