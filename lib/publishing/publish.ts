import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CONNECTIONS_TABLE, getDecryptedTokens, type ConnectionRow } from "./connections";
import { getAdapter } from "./registry";
import {
  PublishAuthError,
  PublishConfigError,
  PublishHttpError,
  type PlatformId,
  type PublishAdapter,
} from "./adapters/types";

export type PostForPublish = {
  id: string;
  user_id: string;
  platform: string;
  title: string | null;
  hook: string | null;
  caption: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[] | null;
  image_asset_id: string | null;
  video_asset_id: string | null;
  meta: Record<string, unknown> | null;
  publish_attempts?: number | null;
};

export type PublishErrorCode =
  | "reconnect_required"
  | "not_connected"
  | "no_content"
  | "not_configured"
  | "rate_limited"
  | "platform_error"
  | "outcome_unknown"
  | "already_publishing";

export type PublishOutcome =
  | {
      ok: true;
      externalPostId: string;
      externalUrl: string | null;
      /** False when the platform accepted the post but Architecta couldn't record it. */
      recorded: boolean;
    }
  | { ok: false; error: string; code: PublishErrorCode; retryable: boolean };

/** Scheduled posts get this many delivery attempts before they are marked failed. */
export const MAX_PUBLISH_ATTEMPTS = 3;
/** A post stuck in `publishing` longer than this is assumed to have lost its worker. */
export const STALE_PUBLISHING_MS = 15 * 60 * 1000;

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  pinterest: "Pinterest",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const MANUAL_CLAIMABLE = ["idea", "draft", "approved", "scheduled", "failed"];
const CRON_CLAIMABLE = ["scheduled"];

function label(platform: string) {
  return PLATFORM_LABELS[platform] ?? platform;
}

function logEvent(event: string, fields: Record<string, unknown>) {
  // Structured, secret-free diagnostics (never pass tokens or raw responses here).
  console.error(JSON.stringify({ scope: "publishing", event, ...fields }));
}

/** Assemble the post's fields into a single body of text to publish. */
export function buildPostText(post: PostForPublish): string {
  const segments: string[] = [];
  if (post.hook) segments.push(post.hook);
  const main = post.caption || post.body;
  if (main) segments.push(main);
  if (post.cta) segments.push(post.cta);
  if (post.hashtags?.length) {
    segments.push(post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
  }
  return segments.filter(Boolean).join("\n\n").trim();
}

async function resolveAssetUrl(
  supabase: SupabaseClient,
  userId: string,
  assetId: string | null
): Promise<string | null> {
  if (!assetId) return null;
  const { data } = await supabase
    .from("architecta_generated_assets")
    .select("storage_bucket, storage_path, external_url")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  if (!data) return null;
  if (data.external_url) return data.external_url as string;
  if (data.storage_bucket && data.storage_path) {
    const { data: signed } = await supabase.storage
      .from(data.storage_bucket as string)
      .createSignedUrl(data.storage_path as string, 60 * 60);
    return signed?.signedUrl ?? null;
  }
  return null;
}

type Failure = { code: PublishErrorCode; userMessage: string; retryable: boolean; raw: string };

function reconnectFailure(platform: string, raw: string): Failure {
  const name = label(platform);
  return {
    code: "reconnect_required",
    userMessage: `Your ${name} connection has expired. Reconnect ${name} to continue publishing.`,
    retryable: false,
    raw,
  };
}

function classifyError(err: unknown, platform: string): Failure {
  const raw = err instanceof Error ? err.message : "Publish failed";
  const name = label(platform);
  if (err instanceof PublishAuthError) return reconnectFailure(platform, raw);
  if (err instanceof PublishConfigError) {
    return {
      code: "not_configured",
      userMessage: `Publishing to ${name} isn't configured right now. Please contact support.`,
      retryable: false,
      raw,
    };
  }
  if (err instanceof PublishHttpError && err.status === 429) {
    return {
      code: "rate_limited",
      userMessage: `${name} is limiting requests right now. Please try again in a little while.`,
      retryable: true,
      raw,
    };
  }
  // A 503 is a well-formed HTTP response: the platform's own infrastructure told
  // us it never processed the request, so it's provably safe to retry.
  if (err instanceof PublishHttpError && err.status === 503) {
    return {
      code: "platform_error",
      userMessage: `${name} couldn't publish this post. Please try again, or edit the post and retry.`,
      retryable: true,
      raw,
    };
  }
  // A bare network failure (fetch rejecting with TypeError) gives no proof the
  // platform never received the request — the response may have been lost after
  // it was accepted. Auto-retrying a non-idempotent publish here could double-post,
  // so this is an ambiguous outcome, not a safe retry.
  if (err instanceof TypeError) {
    return {
      code: "outcome_unknown",
      userMessage: `We couldn't confirm whether this reached ${name}. Check the platform before retrying to avoid a duplicate.`,
      retryable: false,
      raw,
    };
  }
  return {
    code: "platform_error",
    userMessage: `${name} couldn't publish this post. Please try again, or edit the post and retry.`,
    retryable: false,
    raw,
  };
}

function connectionExpired(connection: ConnectionRow, now = Date.now()): boolean {
  if (connection.status !== "connected") return true;
  return !!connection.expires_at && new Date(connection.expires_at).getTime() <= now;
}

async function markConnectionExpired(supabase: SupabaseClient, connection: ConnectionRow) {
  const { error } = await supabase
    .from(CONNECTIONS_TABLE)
    .update({ status: "expired" })
    .eq("id", connection.id);
  if (error) {
    logEvent("connection_expire_update_failed", {
      platform: connection.platform,
      connectionId: connection.id,
      dbError: error.message,
    });
  }
}

/**
 * Atomically move a post into `publishing`. The conditional UPDATE is the lock:
 * only one concurrent caller can match the claimable status, everyone else gets
 * zero rows back. Returns false when the post was not claimable.
 */
export async function claimPost(
  supabase: SupabaseClient,
  post: PostForPublish,
  trigger: "manual" | "scheduled",
  claimedAt: string = new Date().toISOString()
): Promise<boolean> {
  const { data, error } = await supabase
    .from("architecta_posts")
    .update({
      status: "publishing",
      publish_claimed_at: claimedAt,
      // A user-initiated publish starts a fresh attempt budget.
      publish_attempts: trigger === "manual" ? 1 : (post.publish_attempts ?? 0) + 1,
      publish_error: null,
      publish_error_code: null,
    })
    .eq("user_id", post.user_id)
    .eq("id", post.id)
    .in("status", trigger === "manual" ? MANUAL_CLAIMABLE : CRON_CLAIMABLE)
    .select("id");
  if (error) throw new Error(`Failed to claim post: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Posts left in `publishing` past the stale window lost their worker mid-flight.
 * The platform may or may not have received them, so they are NOT retried
 * automatically (that could double-post) — they're failed for the user to check.
 */
export async function sweepStalePublishing(supabase: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PUBLISHING_MS).toISOString();
  const { data, error } = await supabase
    .from("architecta_posts")
    .update({
      status: "failed",
      publish_error:
        "We couldn't confirm whether this post went out. Check the platform before retrying to avoid a duplicate.",
      publish_error_code: "outcome_unknown",
    })
    .eq("status", "publishing")
    .lt("publish_claimed_at", cutoff)
    .select("id");
  if (error) {
    logEvent("stale_sweep_failed", { dbError: error.message });
    return 0;
  }
  return data?.length ?? 0;
}

async function insertLog(supabase: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await supabase.from("architecta_publish_log").insert(row);
  if (error) {
    logEvent("publish_log_insert_failed", {
      postId: row.post_id,
      platform: row.platform,
      dbError: error.message,
    });
  }
}

/** Record a failure: log row + post state (retryable → back to scheduled, else failed). */
async function failPost(args: {
  supabase: SupabaseClient;
  post: PostForPublish;
  platform: string;
  trigger: "manual" | "scheduled";
  failure: Failure;
  attempt: number;
  claimedAt: string;
}): Promise<PublishOutcome> {
  const { supabase, post, platform, trigger, failure, attempt, claimedAt } = args;
  const willRetry =
    failure.retryable && trigger === "scheduled" && attempt < MAX_PUBLISH_ATTEMPTS;

  await insertLog(supabase, {
    user_id: post.user_id,
    post_id: post.id,
    platform,
    status: "error",
    error: failure.raw,
    trigger,
    meta: { code: failure.code, attempt, willRetry },
  });
  logEvent("publish_failed", {
    postId: post.id,
    platform,
    trigger,
    code: failure.code,
    attempt,
    willRetry,
  });

  const { data: updated, error } = await supabase
    .from("architecta_posts")
    .update({
      status: willRetry ? "scheduled" : "failed",
      publish_error: failure.userMessage,
      publish_error_code: failure.code,
    })
    .eq("user_id", post.user_id)
    .eq("id", post.id)
    .eq("status", "publishing")
    // Fences this write to the claim that started this attempt: if the post was
    // swept as stale and re-claimed by another worker in the meantime, this
    // update must not stomp on that newer claim's state.
    .eq("publish_claimed_at", claimedAt)
    .select("id");
  if (error) {
    // Left in `publishing`; the stale sweep will fail it rather than re-send it.
    logEvent("failure_state_update_failed", { postId: post.id, platform, dbError: error.message });
  } else if ((updated?.length ?? 0) === 0) {
    // Someone else's claim now owns this row — do not report a state we didn't record.
    logEvent("failure_state_not_recorded", { postId: post.id, platform, code: failure.code });
  }

  const gaveUp = failure.retryable && !willRetry && trigger === "scheduled";
  return {
    ok: false,
    error: gaveUp
      ? `${failure.userMessage} We gave up after ${attempt} attempts.`
      : failure.userMessage,
    code: failure.code,
    retryable: willRetry,
  };
}

/**
 * Publish a single post to its connected platform.
 *
 * Lifecycle: scheduled|draft|… → publishing (atomic claim, BEFORE any platform
 * call) → published | failed | scheduled (bounded retry, scheduled trigger only).
 * Never throws — returns a discriminated outcome so the cron loop can continue.
 */
export async function publishPost(args: {
  supabase: SupabaseClient;
  post: PostForPublish;
  connection: ConnectionRow | null;
  trigger: "manual" | "scheduled";
}): Promise<PublishOutcome> {
  const { supabase, post, connection, trigger } = args;
  const platform = post.platform as PlatformId;
  const claimedAt = new Date().toISOString();

  let claimed: boolean;
  try {
    claimed = await claimPost(supabase, post, trigger, claimedAt);
  } catch (err) {
    logEvent("claim_failed", {
      postId: post.id,
      platform,
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      error: "We couldn't start publishing this post. Please try again.",
      code: "platform_error",
      retryable: false,
    };
  }
  if (!claimed) {
    return {
      ok: false,
      error: "This post is already being published or has been published.",
      code: "already_publishing",
      retryable: false,
    };
  }
  const attempt = trigger === "manual" ? 1 : (post.publish_attempts ?? 0) + 1;
  const fail = (failure: Failure) =>
    failPost({ supabase, post, platform, trigger, failure, attempt, claimedAt });

  if (!connection) {
    return fail({
      code: "not_connected",
      userMessage: `Connect your ${label(platform)} account to publish this post.`,
      retryable: false,
      raw: "No connection",
    });
  }
  if (connectionExpired(connection)) {
    if (connection.status === "connected") await markConnectionExpired(supabase, connection);
    return fail(reconnectFailure(platform, "Connection expired before publish"));
  }

  let result: Awaited<ReturnType<PublishAdapter["publish"]>>;
  try {
    const adapter = getAdapter(platform);
    const { accessToken } = getDecryptedTokens(connection);
    if (!connection.external_account_id) {
      throw new Error("Connection is missing the external account id");
    }

    const text = buildPostText(post);
    if (!text) {
      return fail({
        code: "no_content",
        userMessage: "This post has no content to publish. Add some text and try again.",
        retryable: false,
        raw: "Post has no content to publish",
      });
    }

    const imageUrl = await resolveAssetUrl(supabase, post.user_id, post.image_asset_id);
    const videoUrl = await resolveAssetUrl(supabase, post.user_id, post.video_asset_id);

    result = await adapter.publish({
      accessToken,
      externalAccountId: connection.external_account_id,
      text,
      imageUrl,
      videoUrl,
    });
  } catch (err) {
    const failure = classifyError(err, platform);
    if (failure.code === "reconnect_required") await markConnectionExpired(supabase, connection);
    return fail(failure);
  }

  // The platform has the post. From here on, never report failure or retry:
  // the only job is recording that it happened.
  if (!result.externalPostId) {
    // The platform accepted the request but returned no id we can trust — still
    // record success (retrying now would risk a duplicate), but make the gap visible.
    logEvent("published_without_external_id", { postId: post.id, platform });
  }
  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("architecta_posts")
    .update({
      status: "published",
      published_at: nowIso,
      publish_error: null,
      publish_error_code: null,
      meta: {
        ...(post.meta ?? {}),
        external_post: {
          platform,
          id: result.externalPostId,
          url: result.externalUrl,
          published_at: nowIso,
        },
      },
    })
    .eq("user_id", post.user_id)
    .eq("id", post.id)
    .eq("status", "publishing")
    // Same claim fence as the failure path: don't overwrite a row that a later
    // claim (after a stale sweep) now owns.
    .eq("publish_claimed_at", claimedAt)
    .select("id");
  const recorded = !updateError && (updated?.length ?? 0) > 0;
  if (!recorded) {
    logEvent("published_but_not_recorded", {
      postId: post.id,
      platform,
      externalPostId: result.externalPostId,
      dbError: updateError?.message ?? "no row matched status=publishing",
    });
  } else {
    // Keep any linked calendar item in sync.
    const { error: calError } = await supabase
      .from("architecta_content_calendar_items")
      .update({ status: "published" })
      .eq("user_id", post.user_id)
      .eq("post_id", post.id);
    if (calError) {
      logEvent("calendar_sync_failed", { postId: post.id, dbError: calError.message });
    }
  }

  await insertLog(supabase, {
    user_id: post.user_id,
    post_id: post.id,
    platform,
    status: "success",
    external_post_id: result.externalPostId || null,
    external_url: result.externalUrl,
    trigger,
    meta: recorded ? {} : { post_state_not_recorded: true },
  });

  return {
    ok: true,
    externalPostId: result.externalPostId,
    externalUrl: result.externalUrl,
    recorded,
  };
}
