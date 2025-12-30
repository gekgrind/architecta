import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemorySignal = {
  signal_type: "tone" | "length" | "cta" | "structure" | string;
  signal_value: string;
  confidence?: number; // default applied server-side
  source?: "architecta" | "prospra" | string; // default = "architecta"
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { graph, meta, memorySignals } = body ?? {};

    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json(
        { ok: false, error: "Invalid graph payload" },
        { status: 400 }
      );
    }

    // ✅ Cookie-auth Supabase client (RLS-safe)
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const workspaceId: string | null = meta?.workspaceId ?? null;

    // Upsert graph (one per user/workspace)
    const { error: saveError } = await supabase
      .from("studio_graphs")
      .upsert(
        {
          user_id: user.id,
          workspace_id: workspaceId,
          graph,
        },
        { onConflict: "user_id,workspace_id" }
      );

    if (saveError) {
      console.error("Supabase save error:", saveError);
      return NextResponse.json(
        { ok: false, error: saveError.message },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // Optional: AI memory learning signals (safe no-op if absent)
    // ------------------------------------------------------------
    if (Array.isArray(memorySignals) && memorySignals.length > 0) {
      const rows = (memorySignals as MemorySignal[])
        .map((s) => ({
          user_id: user.id,
          source: s.source ?? "architecta",
          signal_type: s.signal_type,
          signal_value: s.signal_value,
          confidence: Math.max(0.05, Math.min(1, s.confidence ?? 0.1)),
        }))
        .filter((r) => !!r.signal_type && !!r.signal_value);

      if (rows.length) {
        // Insert lightweight preferences. (If you prefer “increment confidence”
        // behavior, we’ll handle that in a dedicated memory route/helper.)
        const { error: memError } = await supabase
          .from("ai_edit_memory")
          .insert(rows);

        // Do NOT fail the save if memory insert fails.
        if (memError) console.warn("AI memory insert warning:", memError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Studio save route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
