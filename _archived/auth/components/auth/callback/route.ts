import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    const user = data?.user;

    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          null,
        avatar_url: user.user_metadata?.avatar_url || null,
        provider: user.app_metadata?.provider,
      });
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
