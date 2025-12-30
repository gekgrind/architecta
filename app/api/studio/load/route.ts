// app/api/studio/load/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const graphId = searchParams.get("graphId");

  if (!graphId) {
    return NextResponse.json({ error: "graphId required" }, { status: 400 });
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
