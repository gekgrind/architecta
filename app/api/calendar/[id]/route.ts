import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarItemPatchSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = calendarItemPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid patch", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.scheduledFor !== undefined) update.scheduled_for = patch.scheduledFor;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.platform !== undefined) update.platform = patch.platform;

  const { data, error } = await supabase
    .from("architecta_content_calendar_items")
    .update(update)
    .eq("user_id", session.user.id)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  if (data?.post_id && (patch.scheduledFor || patch.status)) {
    const postUpdate: Record<string, unknown> = {};
    if (patch.scheduledFor) postUpdate.scheduled_for = patch.scheduledFor;
    if (patch.status === "published") {
      postUpdate.status = "published";
      postUpdate.published_at = patch.scheduledFor ?? new Date().toISOString();
    } else if (patch.status === "scheduled") {
      postUpdate.status = "scheduled";
    }
    if (Object.keys(postUpdate).length > 0) {
      await supabase
        .from("architecta_posts")
        .update(postUpdate)
        .eq("user_id", session.user.id)
        .eq("id", data.post_id);
    }
  }

  return apiOk({ item: data });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { error } = await supabase
    .from("architecta_content_calendar_items")
    .delete()
    .eq("user_id", session.user.id)
    .eq("id", id);

  if (error) return apiError("server_error", error.message);

  return apiOk({ deleted: true });
}
