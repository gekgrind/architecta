import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // No code = nothing to exchange
  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
  }

  const supabase = await createSupabaseServerClient();

  // 1️⃣ Exchange code for session (sets cookies)
  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
  }

  const userId = data.user.id;

  // 2️⃣ Check onboarding state
  const { data: onboarding } = await supabase
    .from("architecta_onboarding")
    .select("status")
    .eq("user_id", userId)
    .single();

  // 3️⃣ Route correctly
  if (!onboarding || onboarding.status !== "completed") {
    return NextResponse.redirect(
      new URL("/auth/onboarding", request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard", request.url)
  );
}
