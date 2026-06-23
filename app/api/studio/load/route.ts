import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { StudioGraphRecord } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const graphId = searchParams.get("graphId");
  const workspaceId = searchParams.get("workspaceId");

  let query = supabase
    .from("studio_graphs")
    .select("*")
    .eq("user_id", session.user.id);

  if (graphId) {
    query = query.eq("id", graphId);
  } else if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return apiError("server_error", error.message);
  }

  if (!data) {
    return apiOk({ graph: null });
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
