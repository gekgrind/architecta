import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userSettingsPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type SettingsRow = {
  user_id: string;
  workspace_id: string | null;
  text_provider: "anthropic" | "openai" | "auto";
  anthropic_model: string;
  openai_text_model: string;
  openai_image_model: string;
  openai_video_model: string | null;
  default_platforms: string[];
  approval_required: boolean;
  image_style: Record<string, unknown> | null;
  video_style: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const DEFAULTS = {
  text_provider: "anthropic" as const,
  anthropic_model: "claude-sonnet-4-6",
  openai_text_model: "gpt-4o",
  openai_image_model: "gpt-image-1",
  openai_video_model: null as string | null,
  default_platforms: ["linkedin", "instagram", "x"],
  approval_required: false,
  image_style: {} as Record<string, unknown>,
  video_style: {} as Record<string, unknown>,
};

function toCamel(row: SettingsRow | null, userId: string) {
  return {
    userId,
    workspaceId: row?.workspace_id ?? null,
    textProvider: row?.text_provider ?? DEFAULTS.text_provider,
    anthropicModel: row?.anthropic_model ?? DEFAULTS.anthropic_model,
    openaiTextModel: row?.openai_text_model ?? DEFAULTS.openai_text_model,
    openaiImageModel: row?.openai_image_model ?? DEFAULTS.openai_image_model,
    openaiVideoModel: row?.openai_video_model ?? DEFAULTS.openai_video_model,
    defaultPlatforms: row?.default_platforms ?? DEFAULTS.default_platforms,
    approvalRequired: row?.approval_required ?? DEFAULTS.approval_required,
    imageStyle: row?.image_style ?? DEFAULTS.image_style,
    videoStyle: row?.video_style ?? DEFAULTS.video_style,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from("architecta_user_settings")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);

  return apiOk({
    settings: toCamel((data as SettingsRow | null) ?? null, session.user.id),
  });
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = userSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid settings payload", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = { user_id: session.user.id };

  if (patch.workspaceId !== undefined) update.workspace_id = patch.workspaceId;
  if (patch.textProvider !== undefined) update.text_provider = patch.textProvider;
  if (patch.anthropicModel !== undefined)
    update.anthropic_model = patch.anthropicModel;
  if (patch.openaiTextModel !== undefined)
    update.openai_text_model = patch.openaiTextModel;
  if (patch.openaiImageModel !== undefined)
    update.openai_image_model = patch.openaiImageModel;
  if (patch.openaiVideoModel !== undefined)
    update.openai_video_model = patch.openaiVideoModel;
  if (patch.defaultPlatforms !== undefined)
    update.default_platforms = patch.defaultPlatforms;
  if (patch.approvalRequired !== undefined)
    update.approval_required = patch.approvalRequired;
  if (patch.imageStyle !== undefined) update.image_style = patch.imageStyle;
  if (patch.videoStyle !== undefined) update.video_style = patch.videoStyle;

  const { data, error } = await supabase
    .from("architecta_user_settings")
    .upsert(update, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  return apiOk({ settings: toCamel(data as SettingsRow, session.user.id) });
}
