import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { strategyPatchSchema } from "@/lib/validation/strategy";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from("architecta_content_strategies")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);
  if (!data) return apiError("not_found", "Strategy not found");

  return apiOk({ strategy: data });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = strategyPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid patch", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.summary !== undefined) update.summary = patch.summary;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.pillars !== undefined) update.pillars = patch.pillars;
  if (patch.platformStrategy !== undefined)
    update.platform_strategy = patch.platformStrategy;
  if (patch.audienceAngles !== undefined)
    update.audience_angles = patch.audienceAngles;
  if (patch.contentThemes !== undefined)
    update.content_themes = patch.contentThemes;
  if (patch.postingCadence !== undefined)
    update.posting_cadence = patch.postingCadence;
  if (patch.quickWins !== undefined) update.quick_wins = patch.quickWins;
  if (patch.nextActions !== undefined) update.next_actions = patch.nextActions;

  const { data, error } = await supabase
    .from("architecta_content_strategies")
    .update(update)
    .eq("user_id", session.user.id)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  return apiOk({ strategy: data });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { error } = await supabase
    .from("architecta_content_strategies")
    .delete()
    .eq("user_id", session.user.id)
    .eq("id", id);

  if (error) return apiError("server_error", error.message);

  return apiOk({ deleted: true });
}
