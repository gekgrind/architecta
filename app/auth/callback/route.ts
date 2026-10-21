import { NextResponse } from "next/server";

import {
  buildSharedLoginHref,
  getPostAuthRedirectPath,
  hasSharedAuthLoopRisk,
  sanitizePostAuthRedirectPath,
} from "@/lib/auth/redirects";
import { getPublicAppOrigin } from "@/lib/auth/same-origin";
import { getArchitectaOnboardingStatus } from "@/lib/onboarding/server";
import { applyAuthResponseHeaders } from "@/lib/supabase/auth-cookie-cleanup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  /* Redirect base: the public origin, never the `next start` bind
     address that `request.url` names behind nginx. */
  const publicOrigin = getPublicAppOrigin({ nextUrl: url });
  const nextTarget = url.searchParams.get("next");
  const nextPath = sanitizePostAuthRedirectPath(nextTarget);
  /* Whatever Supabase sends with a session write, on top of the
     anti-cache defaults every redirect here carries. */
  let supabaseHeaders: Record<string, string> = {};
  const supabase = await createSupabaseServerClient({
    onAuthResponseHeaders(headers) {
      supabaseHeaders = { ...supabaseHeaders, ...headers };
    },
  });

  /* getUser() below may refresh the session, so no redirect may be
     cached beside a Set-Cookie. */
  function redirect(target: URL) {
    const response = NextResponse.redirect(target);
    applyAuthResponseHeaders(response);
    applyAuthResponseHeaders(response, supabaseHeaders);

    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginHref = buildSharedLoginHref(nextTarget ?? nextPath);

    if (hasSharedAuthLoopRisk(url, loginHref)) {
      return redirect(new URL("/", publicOrigin));
    }

    return redirect(new URL(loginHref, publicOrigin));
  }

  const onboarding = await getArchitectaOnboardingStatus();

  const redirectPath = getPostAuthRedirectPath(
    onboarding.onboardingComplete,
    nextTarget ?? nextPath
  );

  return redirect(new URL(redirectPath, publicOrigin));
}
