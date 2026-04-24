import { apiError, apiOk } from "@/lib/api/response";
import type { StudioGraphRecord } from "@/lib/domain";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServiceClient();
  const { searchParams } = new URL(req.url);
  const graphId = searchParams.get("graphId");

  if (!graphId) {
    return apiError("validation_error", "graphId required");
  }

  const { data, error } = await supabase
    .from("architecta_graphs")
    .select("*")
    .eq("id", graphId)
    .single();

  if (error) {
    return apiError("server_error", error.message);
  }

  const graph: StudioGraphRecord = {
    id: data.id,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    graph: data.graph,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  return apiOk({ graph });
}
