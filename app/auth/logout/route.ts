import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_RECOVERY_PATH,
  SESSION_RECOVERY_REASONS,
  buildSharedLoginHref,
  sanitizePostAuthRedirectPath,
} from "@/lib/auth/redirects";
import {
  getTrustedAppOrigins,
  isSameOriginRequest,
} from "@/lib/auth/same-origin";
import { getSupabaseProjectConfig } from "@/lib/config/ecosystem";
import {
  AUTH_NO_STORE_HEADERS,
  applyAuthResponseHeaders,
  expireAllAuthCookies,
  readAuthCookieInventory,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  revokeSessionCandidates,
  type RevocationReport,
  type RevocationStatus,
} from "@/lib/supabase/auth-session-resolution";
import { getSharedSupabaseCookieOptions } from "@/lib/supabase/cookies";

/*
 * Sign-out. The middleware passes this path through untouched, so the
 * route sees the browser's own cookie inventory, every copy included.
 *
 * GET changes nothing: a state-changing GET could be triggered by any
 * page with an <img>. It forwards to the confirmation page, whose button
 * POSTs here; the POST is refused unless it provably comes from this site.
 */

export function GET(request: NextRequest) {
  const target = new URL(SESSION_RECOVERY_PATH, request.url);
  const reason = request.nextUrl.searchParams.get("reason");
  const next = request.nextUrl.searchParams.get("next");

  if (reason && (SESSION_RECOVERY_REASONS as readonly string[]).includes(reason)) {
    target.searchParams.set("reason", reason);
  }
  if (next) {
    target.searchParams.set("next", sanitizePostAuthRedirectPath(next));
  }

  const response = NextResponse.redirect(target, 303);
  applyAuthResponseHeaders(response);

  return response;
}

function getSupabaseConfigOrNull() {
  try {
    return getSupabaseProjectConfig();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, getTrustedAppOrigins(request))) {
    return new NextResponse("Sign-out must come from this site.", {
      status: 403,
      headers: AUTH_NO_STORE_HEADERS,
    });
  }

  const authCookies = readAuthCookieInventory(request);
  const supabaseConfig = getSupabaseConfigOrNull();
  let report: RevocationReport | null = null;

  if (supabaseConfig) {
    /* Revokes every sign-in the browser holds a copy of, each judged on
       its own tokens: a collapsed name-keyed read would revoke only
       whichever generation was sent last. Deliberately not the
       next/headers server client: any `cookies()` write here makes Next
       rebuild this response's Set-Cookie headers from a name-keyed map,
       which collapses the paired host-only / `.entrepreneuria.io`
       expiries below to one scope per name, so a host-only Architecta
       copy of the session would survive logout. */
    report = await revokeSessionCandidates(authCookies, {
      supabaseUrl: supabaseConfig.url,
      supabaseKey: supabaseConfig.anonKey,
      cookieOptions: getSharedSupabaseCookieOptions(authCookies.cookieHostname),
    });
  }

  /* Without the Auth API nothing is confirmed: any credential the
     browser held may still work. Deleting local cookies alone is never
     reported as a sign-out everywhere. */
  const status: RevocationStatus =
    report?.status ??
    (authCookies.candidates.length > 0 ||
    authCookies.candidatesTruncated ||
    authCookies.legacy.length > 0
      ? "incomplete"
      : "local");

  /* Only a confirmed sign-out everywhere goes straight to sign-in.
     Anything less lands on a page that says what was and wasn't
     confirmed. No retry happens on its own. */
  const response = NextResponse.redirect(
    status === "complete"
      ? new URL(buildSharedLoginHref("/dashboard"), request.url)
      : new URL(`${SESSION_RECOVERY_PATH}?status=${status}`, request.url),
    303
  );

  /* Local cleanup never depends on the Auth API: every session chunk and
     legacy auth cookie the browser sent is expired, in the host-only
     Architecta scope and on `.entrepreneuria.io`, uncacheably. */
  expireAllAuthCookies(authCookies, response);

  response.headers.set("X-Auth-Revocation", status);

  if (status !== "complete") {
    /* Counts only: never a token, cookie value or user id. */
    console.warn("[auth] sign-out not confirmed everywhere", {
      status,
      configured: Boolean(supabaseConfig),
      candidates: report?.candidates ?? authCookies.candidates.length,
      revoked: report?.revoked ?? 0,
      alreadyInvalid: report?.alreadyInvalid ?? 0,
      uncertain: report?.uncertain ?? 0,
      skipped: report?.skipped ?? 0,
      usersSignedOut: report?.usersSignedOut ?? 0,
      usersUnconfirmed: report?.usersUnconfirmed ?? 0,
      legacyCookies: authCookies.legacy.length,
    });
  }

  return response;
}
