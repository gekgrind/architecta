import "server-only";

import { apiError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type RateLimitRule = {
  /** Stable identifier for the action, e.g. "posts.generate". */
  action: string;
  /** Max calls allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
  limit: number;
};

type RpcRow = {
  allowed: boolean;
  remaining: number;
  reset_at: string | null;
};

/**
 * Atomic fixed-window rate limit check, backed by Postgres.
 *
 * Called via the service-role client so the counter key (`action:userId`) is
 * server-authoritative — a user cannot inflate or read another user's bucket.
 *
 * Fails OPEN: if the limiter itself errors we allow the request rather than
 * breaking the product, but we log so the failure is visible.
 */
export async function checkRateLimit(
  userId: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const key = `${rule.action}:${userId}`;
  try {
    const supabase = await createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("architecta_check_rate_limit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error || !data) {
      console.warn("[ratelimit] check failed, allowing:", error?.message);
      return { allowed: true, remaining: rule.limit, resetAt: null, limit: rule.limit };
    }

    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
    if (!row) {
      return { allowed: true, remaining: rule.limit, resetAt: null, limit: rule.limit };
    }

    return {
      allowed: Boolean(row.allowed),
      remaining: typeof row.remaining === "number" ? row.remaining : 0,
      resetAt: row.reset_at ?? null,
      limit: rule.limit,
    };
  } catch (err) {
    console.warn(
      "[ratelimit] error, allowing:",
      err instanceof Error ? err.message : err
    );
    return { allowed: true, remaining: rule.limit, resetAt: null, limit: rule.limit };
  }
}

/** Build a 429 response with Retry-After + rate-limit detail headers. */
export function rateLimitedResponse(result: RateLimitResult) {
  const resetMs = result.resetAt ? new Date(result.resetAt).getTime() : null;
  const retryAfterSeconds =
    resetMs !== null ? Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)) : 60;

  const headers = new Headers({
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
  });
  if (result.resetAt) headers.set("X-RateLimit-Reset", result.resetAt);

  return apiError(
    "rate_limited",
    `Rate limit reached. Try again in about ${retryAfterSeconds}s.`,
    {
      headers,
      details: {
        limit: result.limit,
        remaining: Math.max(result.remaining, 0),
        resetAt: result.resetAt,
        retryAfterSeconds,
      },
    }
  );
}

/**
 * Convenience: check a rule and, if exceeded, return a ready 429 response.
 * Returns `null` when the request is allowed.
 */
export async function enforceRateLimit(userId: string, rule: RateLimitRule) {
  const result = await checkRateLimit(userId, rule);
  return result.allowed ? null : rateLimitedResponse(result);
}

/** Centralized limits per AI action. Tune here. */
export const RATE_LIMITS = {
  llmGenerate: { action: "llm.generate", limit: 30, windowSeconds: 60 },
  postGenerate: { action: "posts.generate", limit: 20, windowSeconds: 60 },
  strategyGenerate: { action: "strategies.generate", limit: 10, windowSeconds: 60 },
  campaignGenerate: { action: "campaigns.generate", limit: 4, windowSeconds: 60 },
  imageGenerate: { action: "assets.image", limit: 10, windowSeconds: 60 },
  videoGenerate: { action: "assets.video", limit: 5, windowSeconds: 60 },
  publish: { action: "posts.publish", limit: 10, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;
