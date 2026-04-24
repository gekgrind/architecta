import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeAuthRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  // No code = nothing to exchange
  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth/login?next=${encodeURIComponent(next)}`, request.url)
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(
      new URL(`/auth/login?next=${encodeURIComponent(next)}`, request.url)
    );
  }

  const user = data?.user;

  if (user) {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      provider: user.app_metadata?.provider,
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
