import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * Create a Supabase server client (Next.js 15 compatible)
 */
async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

/**
 * GET /api/founder-style
 * Fetch latest founder style profile
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspaceId" },
      { status: 400 }
    );
  }

  const { data } = await supabase
    .from("founder_style_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ profile: data });
}

/**
 * POST /api/founder-style
 * Save new founder style profile version
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServer(); // 🔑 FIX: await was missing

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, profileText } = body;

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspaceId" },
      { status: 400 }
    );
  }

  if (!profileText || profileText.length < 20) {
    return NextResponse.json(
      { error: "Profile text too short" },
      { status: 400 }
    );
  }

  // Fetch latest version
  const { data: existing } = await supabase
    .from("founder_style_profiles")
    .select("version, confidence_score")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("founder_style_profiles").insert({
    user_id: user.id,
    workspace_id: workspaceId,
    profile_text: profileText,
    version: (existing?.version ?? 0) + 1,
    confidence_score: Math.min(
      1,
      (existing?.confidence_score ?? 0.5) + 0.1
    ),
  });

  return NextResponse.json({ ok: true });
}
