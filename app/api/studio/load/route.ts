// app/api/studio/load/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const supabase = await getSupabaseServer();

  const { searchParams } = new URL(req.url);
  const graphId = searchParams.get("graphId");

  if (!graphId) {
    return NextResponse.json(
      { error: "graphId required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("architecta_graphs")
    .select("*")
    .eq("id", graphId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
