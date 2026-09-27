import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  scheduleErrorResponse,
  schedulePost,
  unschedulePost,
} from "@/lib/publishing/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarItemInputSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";

type CalendarRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  post_id: string | null;
  campaign_id: string | null;
  scheduled_for: string;
  platform: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: CalendarRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    postId: row.post_id,
    campaignId: row.campaign_id,
    scheduledFor: row.scheduled_for,
    platform: row.platform,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  let query = supabase
    .from("architecta_content_calendar_items")
    .select("*")
    .eq("user_id", session.user.id)
    .order("scheduled_for", { ascending: true })
    .limit(500);

  if (from) query = query.gte("scheduled_for", from);
  if (to) query = query.lte("scheduled_for", to);
  if (platform) query = query.eq("platform", platform);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return apiError("server_error", error.message);

  const rows = (data ?? []) as CalendarRow[];

  // Surface each linked post's publishing state (publishing / failed / reconnect) alongside the item.
  const postIds = rows.map((r) => r.post_id).filter((id): id is string => !!id);
  const publishByPost = new Map<
    string,
    { status: string; error: string | null; errorCode: string | null }
  >();
  if (postIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from("architecta_posts")
      .select("id, status, publish_error, publish_error_code")
      .eq("user_id", session.user.id)
      .in("id", postIds);
    // A failed lookup here is not "no linked posts" — surfacing it as such would
    // silently hide publishing/failed states and show a Publish action the
    // server would reject. Fail loudly instead, matching the primary query.
    if (postsError) return apiError("server_error", postsError.message);
    for (const p of posts ?? []) {
      publishByPost.set(p.id as string, {
        status: p.status as string,
        error: (p.publish_error as string | null) ?? null,
        errorCode: (p.publish_error_code as string | null) ?? null,
      });
    }
  }

  return apiOk({
    items: rows.map((row) => {
      const publish = row.post_id ? publishByPost.get(row.post_id) : undefined;
      return {
        ...toCamel(row),
        postStatus: publish?.status ?? null,
        publishError: publish?.error ?? null,
        publishErrorCode: publish?.errorCode ?? null,
      };
    }),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = calendarItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid calendar payload", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  const userId = session.user.id;
  const fields = {
    workspace_id: input.workspaceId ?? null,
    campaign_id: input.campaignId ?? null,
    scheduled_for: input.scheduledFor,
    platform: input.platform,
    status: input.status,
    notes: input.notes ?? null,
  };

  // One calendar item per post: re-scheduling a post reuses its existing item
  // instead of adding a second entry for the same post.
  let existing: CalendarRow | null = null;
  if (input.postId) {
    const { data: found, error: findError } = await supabase
      .from("architecta_content_calendar_items")
      .select("*")
      .eq("user_id", userId)
      .eq("post_id", input.postId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (findError) return apiError("server_error", findError.message);
    existing = ((found ?? []) as CalendarRow[])[0] ?? null;

    // A non-scheduled entry must not leave the post publishable: take it out of
    // the queue before touching the calendar.
    if (input.status !== "scheduled") {
      const unscheduled = await unschedulePost(supabase, userId, input.postId);
      if (!unscheduled.ok) return scheduleErrorResponse(unscheduled);
    }
  }

  const { data, error } = existing
    ? await supabase
        .from("architecta_content_calendar_items")
        .update(fields)
        .eq("user_id", userId)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase
        .from("architecta_content_calendar_items")
        .insert({ ...fields, user_id: userId, post_id: input.postId ?? null })
        .select("*")
        .single();

  if (error) return apiError("server_error", error.message);
  const item = data as CalendarRow;

  // The post row is what the publish worker reads. It is written last, so a
  // failure here leaves the post unpublishable; the calendar write is then
  // rolled back so the UI doesn't show a schedule that won't happen.
  if (input.postId && input.status === "scheduled") {
    const scheduled = await schedulePost(supabase, userId, input.postId, input.scheduledFor);
    if (!scheduled.ok) {
      const rollback = existing
        ? supabase
            .from("architecta_content_calendar_items")
            .update({
              workspace_id: existing.workspace_id,
              campaign_id: existing.campaign_id,
              scheduled_for: existing.scheduled_for,
              platform: existing.platform,
              status: existing.status,
              notes: existing.notes,
            })
            .eq("user_id", userId)
            .eq("id", existing.id)
        : supabase
            .from("architecta_content_calendar_items")
            .delete()
            .eq("user_id", userId)
            .eq("id", item.id);
      const { error: rollbackError } = await rollback;
      if (rollbackError) {
        console.error(
          JSON.stringify({
            scope: "calendar",
            event: "schedule_rollback_failed",
            itemId: item.id,
            dbError: rollbackError.message,
          })
        );
      }
      return scheduleErrorResponse(scheduled);
    }
  }

  return apiOk({ item: toCamel(item) });
}
