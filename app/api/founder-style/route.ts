import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  const { data } = await supabase
    .from("founder_style_profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ profile: data });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, profileText } = body;

  if (!profileText || profileText.length < 20) {
    return NextResponse.json(
      { error: "Profile text too short" },
      { status: 400 }
    );
  }

  // get current version
  const { data: existing } = await supabase
    .from("founder_style_profiles")
    .select("version, confidence_score")
    .eq("user_id", auth.user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("founder_style_profiles").insert({
    user_id: auth.user.id,
    workspace_id: workspaceId,
    profile_text: profileText,
    version: (existing?.version ?? 0) + 1,
    confidence_score: Math.min(1, (existing?.confidence_score ?? 0.5) + 0.1),
  });

  return NextResponse.json({ ok: true });
}
