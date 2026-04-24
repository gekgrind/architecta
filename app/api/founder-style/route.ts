import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { FounderProfile } from "@/lib/domain";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type FounderStyleSaveRequest = {
  workspaceId?: string | null;
  profileText?: string;
};

function toFounderProfile(row: Record<string, unknown>, userId: string): FounderProfile {
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    userId,
    workspaceId: typeof row.workspace_id === "string" ? row.workspace_id : null,
    profileText: String(row.profile_text ?? ""),
    confidenceScore: Number(row.confidence_score ?? 0),
    version: Number(row.version ?? 0),
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServiceClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return apiError("validation_error", "Missing workspaceId");
  }

  const { data, error } = await supabase
    .from("founder_style_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);

  return apiOk({
    profile: data ? toFounderProfile(data, session.user.id) : null,
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServiceClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<FounderStyleSaveRequest>(req);
  const workspaceId = body?.workspaceId;
  const profileText = body?.profileText?.trim();

  if (!workspaceId) {
    return apiError("validation_error", "Missing workspaceId");
  }

  if (!profileText || profileText.length < 20) {
    return apiError("validation_error", "Profile text too short");
  }

  const { data: existing, error: existingError } = await supabase
    .from("founder_style_profiles")
    .select("version, confidence_score")
    .eq("user_id", session.user.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return apiError("server_error", existingError.message);

  const nextVersion = Number(existing?.version ?? 0) + 1;
  const confidenceScore = Math.min(
    1,
    Number(existing?.confidence_score ?? 0.5) + 0.1
  );

  const { error } = await supabase.from("founder_style_profiles").insert({
    user_id: session.user.id,
    workspace_id: workspaceId,
    profile_text: profileText,
    version: nextVersion,
    confidence_score: confidenceScore,
  });

  if (error) return apiError("server_error", error.message);

  return apiOk({
    saved: true,
    version: nextVersion,
    confidenceScore,
  });
}
