import { NextResponse } from "next/server";

import { buildSharedLoginHref } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(buildSharedLoginHref("/dashboard"), request.url)
  );
}
