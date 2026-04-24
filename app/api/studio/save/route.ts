import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { StudioSaveRequest } from "@/lib/domain";
import { isStudioGraph } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<StudioSaveRequest>(req);
    const graph = body?.graph;

    if (!isStudioGraph(graph)) {
      return apiError("validation_error", "Invalid graph payload");
    }

    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return apiError("unauthorized", "Unauthorized");

    const workspaceId = body?.meta?.workspaceId ?? null;

    const { error: saveError } = await supabase
      .from("studio_graphs")
      .upsert(
        {
          user_id: session.user.id,
          workspace_id: workspaceId,
          graph,
        },
        { onConflict: "user_id,workspace_id" }
      );

    if (saveError) {
      console.error("Supabase save error:", saveError);
      return apiError("server_error", saveError.message);
    }

    const memorySignals = body?.memorySignals ?? [];
    const rows = memorySignals
      .map((signal) => ({
        user_id: session.user.id,
        source: signal.source ?? "architecta",
        signal_type: signal.signalType,
        signal_value: signal.signalValue,
        confidence: Math.max(0.05, Math.min(1, signal.confidence ?? 0.1)),
      }))
      .filter((row) => row.signal_type && row.signal_value);

    if (rows.length > 0) {
      const { error: memError } = await supabase
        .from("ai_edit_memory")
        .insert(rows);

      if (memError) console.warn("AI memory insert warning:", memError);
    }

    return apiOk({ saved: true });
  } catch (err) {
    console.error("Studio save route error:", err);
    return apiError("server_error", "Server error");
  }
}
