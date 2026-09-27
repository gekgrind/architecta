import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from("architecta_posts")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);
  if (!data) return apiError("not_found", "Post not found");

  return apiOk({ post: data });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = postPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid patch", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.hook !== undefined) update.hook = patch.hook;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.hashtags !== undefined) update.hashtags = patch.hashtags;
  if (patch.cta !== undefined) update.cta = patch.cta;
  if (patch.imagePrompt !== undefined) update.image_prompt = patch.imagePrompt;
  if (patch.videoPrompt !== undefined) update.video_prompt = patch.videoPrompt;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.scheduledFor !== undefined) update.scheduled_for = patch.scheduledFor;
  if (patch.publishedAt !== undefined) update.published_at = patch.publishedAt;

  const { data, error } = await supabase
    .from("architecta_posts")
    .update(update)
    .eq("user_id", session.user.id)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return apiError("server_error", error.message);
  // No row matched this user + id: never report an edit that wasn't persisted.
  if (!data) return apiError("not_found", "Post not found");

  return apiOk({ post: data });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { error } = await supabase
    .from("architecta_posts")
    .delete()
    .eq("user_id", session.user.id)
    .eq("id", id);

  if (error) return apiError("server_error", error.message);

  return apiOk({ deleted: true });
}
