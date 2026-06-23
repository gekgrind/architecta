import { NextResponse } from "next/server";

import {
  buildSharedLoginHref,
  getPostAuthRedirectPath,
  hasSharedAuthLoopRisk,
  sanitizePostAuthRedirectPath,
} from "@/lib/auth/redirects";
import { getArchitectaOnboardingStatus } from "@/lib/onboarding/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextTarget = url.searchParams.get("next");
  const nextPath = sanitizePostAuthRedirectPath(nextTarget);
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginHref = buildSharedLoginHref(nextTarget ?? nextPath);

    if (hasSharedAuthLoopRisk(url, loginHref)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL(loginHref, request.url));
  }

  const onboarding = await getArchitectaOnboardingStatus();

  const redirectPath = getPostAuthRedirectPath(
    onboarding.onboardingComplete,
    nextTarget ?? nextPath
  );

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
