import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "@/lib/api/response";

/**
 * The post row — not the calendar item — is what the publish worker reads:
 * a post is publishable only while `status = 'scheduled'` and
 * `scheduled_for <= now()`. Calendar routes go through these helpers so every
 * schedule change lands on the post row and every failure is reported.
 */

/** Statuses a post may be (re)scheduled from. Never `publishing` or `published`. */
const SCHEDULABLE_POST_STATUSES = ["idea", "draft", "approved", "scheduled", "failed", "archived"];

export type ScheduleResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 500; message: string };

function dbFailure(message: string): ScheduleResult {
  return { ok: false, status: 500, message };
}

export function scheduleErrorResponse(result: Extract<ScheduleResult, { ok: false }>) {
  if (result.status === 404) return apiError("not_found", result.message);
  if (result.status === 409) return apiError("bad_request", result.message, { status: 409 });
  return apiError("server_error", result.message);
}

/** Make the post publishable at `scheduledFor`. Refuses posts that are publishing/published. */
export async function schedulePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  scheduledFor: string
): Promise<ScheduleResult> {
  const { data, error } = await supabase
    .from("architecta_posts")
    .update({ status: "scheduled", scheduled_for: scheduledFor })
    .eq("user_id", userId)
    .eq("id", postId)
    .in("status", SCHEDULABLE_POST_STATUSES)
    .select("id");
  if (error) return dbFailure(error.message);
  if ((data?.length ?? 0) === 0) {
    return {
      ok: false,
      status: 409,
      message: "This post can't be scheduled — it is publishing, already published, or no longer exists.",
    };
  }
  return { ok: true };
}

/**
 * Take the post out of the publishing queue (`draft`, no `scheduled_for`).
 * Succeeds when the post is not publishable afterwards; fails when the write
 * errors or a delivery is already in flight (it can't be recalled).
 */
export async function unschedulePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<ScheduleResult> {
  const { data, error } = await supabase
    .from("architecta_posts")
    .update({ status: "draft", scheduled_for: null })
    .eq("user_id", userId)
    .eq("id", postId)
    .eq("status", "scheduled")
    .select("id");
  if (error) return dbFailure(error.message);
  if ((data?.length ?? 0) > 0) return { ok: true };

  // Nothing was scheduled — confirm it isn't mid-publish before reporting success.
  const { data: post, error: readError } = await supabase
    .from("architecta_posts")
    .select("status")
    .eq("user_id", userId)
    .eq("id", postId)
    .maybeSingle();
  if (readError) return dbFailure(readError.message);
  if (post?.status === "publishing") {
    return {
      ok: false,
      status: 409,
      message: "This post is being published right now and can't be unscheduled.",
    };
  }
  return { ok: true };
}
