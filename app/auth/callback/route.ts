import { NextResponse } from "next/server";

import {
  buildSharedLoginHref,
  getPostAuthRedirectPath,
  hasSharedAuthLoopRisk,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = sanitizeAuthRedirectPath(url.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginHref = buildSharedLoginHref(nextPath);

    if (hasSharedAuthLoopRisk(url, loginHref)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL(loginHref, request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  const redirectPath = getPostAuthRedirectPath(
    Boolean(profile?.onboarding_complete),
    nextPath
  );

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
