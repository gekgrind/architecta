import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { campaignPatchSchema } from "@/lib/validation/campaign";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data: campaign, error } = await supabase
    .from("architecta_campaigns")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);
  if (!campaign) return apiError("not_found", "Campaign not found");

  const { data: posts, error: postsError } = await supabase
    .from("architecta_posts")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  if (postsError) return apiError("server_error", postsError.message);

  return apiOk({ campaign, posts: posts ?? [] });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = campaignPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid patch", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.theme !== undefined) update.theme = patch.theme;
  if (patch.goal !== undefined) update.goal = patch.goal;
  if (patch.launchDate !== undefined) update.launch_date = patch.launchDate;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await supabase
    .from("architecta_campaigns")
    .update(update)
    .eq("user_id", session.user.id)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  return apiOk({ campaign: data });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { error } = await supabase
    .from("architecta_campaigns")
    .delete()
    .eq("user_id", session.user.id)
    .eq("id", id);

  if (error) return apiError("server_error", error.message);

  return apiOk({ deleted: true });
}
