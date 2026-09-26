import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  scheduleErrorResponse,
  schedulePost,
  unschedulePost,
} from "@/lib/publishing/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarItemPatchSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type CalendarRow = {
  id: string;
  post_id: string | null;
  scheduled_for: string;
  status: string;
  notes: string | null;
  platform: string;
};

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");
  const userId = session.user.id;

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

  const { data: current, error: readError } = await supabase
    .from("architecta_content_calendar_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (readError) return apiError("server_error", readError.message);
  if (!current) return apiError("not_found", "Calendar item not found");
  const before = current as CalendarRow;

  const updateItem = (values: Record<string, unknown>) =>
    supabase
      .from("architecta_content_calendar_items")
      .update(values)
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .single();

  const postId = before.post_id;
  const nextStatus = patch.status ?? before.status;
  const touchesSchedule = patch.status !== undefined || patch.scheduledFor !== undefined;

  if (!postId || !touchesSchedule) {
    const { data, error } = await updateItem(update);
    if (error) return apiError("server_error", error.message);
    return apiOk({ item: data });
  }

  if (nextStatus === "scheduled") {
    // (Re)scheduling: calendar first, post last. If the post write fails the
    // calendar is restored, so the UI keeps showing the schedule the worker
    // will actually use.
    const { data, error } = await updateItem(update);
    if (error) return apiError("server_error", error.message);
    const item = data as CalendarRow;

    const scheduled = await schedulePost(supabase, userId, postId, item.scheduled_for);
    if (!scheduled.ok) {
      const { error: rollbackError } = await supabase
        .from("architecta_content_calendar_items")
        .update({
          scheduled_for: before.scheduled_for,
          status: before.status,
          notes: before.notes,
          platform: before.platform,
        })
        .eq("user_id", userId)
        .eq("id", id);
      if (rollbackError) {
        console.error(
          JSON.stringify({
            scope: "calendar",
            event: "reschedule_rollback_failed",
            itemId: id,
            dbError: rollbackError.message,
          })
        );
      }
      return scheduleErrorResponse(scheduled);
    }
    return apiOk({ item });
  }

  // Leaving `scheduled`: the post is taken out of the publishing queue FIRST,
  // so a failure can never leave it publishable behind an unscheduled-looking
  // calendar item.
  if (patch.status === "published") {
    const { error: postError } = await supabase
      .from("architecta_posts")
      .update({
        status: "published",
        published_at: patch.scheduledFor ?? new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", postId);
    if (postError) return apiError("server_error", postError.message);
  } else if (nextStatus !== "published") {
    const unscheduled = await unschedulePost(supabase, userId, postId);
    if (!unscheduled.ok) return scheduleErrorResponse(unscheduled);
  }

  const { data, error } = await updateItem(update);
  if (error) return apiError("server_error", error.message);
  return apiOk({ item: data });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");
  const userId = session.user.id;

  const { data: current, error: readError } = await supabase
    .from("architecta_content_calendar_items")
    .select("id, post_id")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (readError) return apiError("server_error", readError.message);
  if (!current) return apiError("not_found", "Calendar item not found");

  // Unschedule the linked post before removing its calendar item: if this
  // fails nothing is deleted, and if the delete below fails the post is
  // already out of the publishing queue.
  const postId = (current as { post_id: string | null }).post_id;
  if (postId) {
    const unscheduled = await unschedulePost(supabase, userId, postId);
    if (!unscheduled.ok) return scheduleErrorResponse(unscheduled);
  }

  const { error } = await supabase
    .from("architecta_content_calendar_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) return apiError("server_error", error.message);

  return apiOk({ deleted: true });
}
