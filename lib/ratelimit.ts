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
  /** Set when the limiter itself failed and the check failed closed. */
  unavailable?: boolean;
};

export type RateLimitOptions = {
  /**
   * Deny (instead of allow) when the limiter itself errors. Required for
   * anything that spends money on AI providers.
   */
  failClosed?: boolean;
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
 * Fails OPEN by default: if the limiter itself errors we allow the request
 * rather than breaking the product, but we log so the failure is visible.
 * Cost-incurring AI paths pass `failClosed` (see `checkAiUsage`).
 */
export async function checkRateLimit(
  userId: string,
  rule: RateLimitRule,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const key = `${rule.action}:${userId}`;
  const onFailure = (): RateLimitResult =>
    options.failClosed
      ? { allowed: false, remaining: 0, resetAt: null, limit: rule.limit, unavailable: true }
      : { allowed: true, remaining: rule.limit, resetAt: null, limit: rule.limit };
  try {
    const supabase = await createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("architecta_check_rate_limit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error || !data) {
      console.warn(
        `[ratelimit] check failed, ${options.failClosed ? "denying" : "allowing"}:`,
        error?.message
      );
      return onFailure();
    }

    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
    if (!row) {
      return onFailure();
    }

    return {
      allowed: Boolean(row.allowed),
      remaining: typeof row.remaining === "number" ? row.remaining : 0,
      resetAt: row.reset_at ?? null,
      limit: rule.limit,
    };
  } catch (err) {
    console.warn(
      `[ratelimit] error, ${options.failClosed ? "denying" : "allowing"}:`,
      err instanceof Error ? err.message : err
    );
    return onFailure();
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
  postGenerate: { action: "posts.generate", limit: 20, windowSeconds: 60 },
  postRevise: { action: "posts.revise", limit: 10, windowSeconds: 60 },
  strategyGenerate: { action: "strategies.generate", limit: 10, windowSeconds: 60 },
  campaignGenerate: { action: "campaigns.generate", limit: 4, windowSeconds: 60 },
  imageGenerate: { action: "assets.image", limit: 10, windowSeconds: 60 },
  videoGenerate: { action: "assets.video", limit: 5, windowSeconds: 60 },
  studioGenerate: { action: "studio.generate", limit: 20, windowSeconds: 60 },
  studioRefine: { action: "studio.refine", limit: 20, windowSeconds: 60 },
  studioLearn: { action: "studio.learn", limit: 4, windowSeconds: 60 },
  onboardingSuggest: { action: "onboarding.suggest", limit: 10, windowSeconds: 60 },
  websiteAnalysis: { action: "onboarding.website_analysis", limit: 5, windowSeconds: 600 },
  publish: { action: "posts.publish", limit: 10, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/* =======================================================
   AI usage guard: per-action limit + daily per-user budget
======================================================= */

/** Pre-launch default: AI requests per user per UTC day (all AI actions combined). */
export const DEFAULT_AI_DAILY_REQUEST_LIMIT = 50;

/** Server-side only: `AI_DAILY_REQUEST_LIMIT` (positive integer) overrides the default. */
export function getAiDailyRequestLimit(): number {
  const raw = process.env.AI_DAILY_REQUEST_LIMIT?.trim();
  if (!raw) return DEFAULT_AI_DAILY_REQUEST_LIMIT;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_AI_DAILY_REQUEST_LIMIT;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return d.toISOString();
}

/**
 * The daily budget is a fixed-window counter whose key embeds the UTC date,
 * so it resets at 00:00 UTC regardless of when the first request landed.
 */
export function aiDailyBudgetRule(now: Date = new Date()): RateLimitRule {
  return {
    action: `ai.daily.${utcDay(now)}`,
    limit: getAiDailyRequestLimit(),
    windowSeconds: 24 * 60 * 60,
  };
}

export type AiUsageDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "rate_limited" | "daily_limit" | "unavailable";
      result: RateLimitResult;
    };

/**
 * Gate for every cost-incurring AI action: the action's own short-window
 * limit, then the user's daily AI budget. Both fail CLOSED — a limiter outage
 * never grants unlimited AI access.
 */
export async function checkAiUsage(
  userId: string,
  rule: RateLimitRule,
  now: Date = new Date()
): Promise<AiUsageDecision> {
  const perAction = await checkRateLimit(userId, rule, { failClosed: true });
  if (!perAction.allowed) {
    return {
      allowed: false,
      reason: perAction.unavailable ? "unavailable" : "rate_limited",
      result: perAction,
    };
  }

  const daily = await checkRateLimit(userId, aiDailyBudgetRule(now), { failClosed: true });
  if (!daily.allowed) {
    return {
      allowed: false,
      reason: daily.unavailable ? "unavailable" : "daily_limit",
      result: { ...daily, resetAt: daily.unavailable ? null : nextUtcMidnight(now) },
    };
  }

  return { allowed: true };
}

const AI_UNAVAILABLE_MESSAGE =
  "AI features are temporarily unavailable. Please try again shortly.";
const AI_DAILY_LIMIT_MESSAGE =
  "You've reached today's AI usage limit. It resets at 00:00 UTC.";

/** User-safe explanation for a denied AI request (server actions). */
export function aiUsageDeniedMessage(
  decision: Extract<AiUsageDecision, { allowed: false }>
): string {
  if (decision.reason === "unavailable") return AI_UNAVAILABLE_MESSAGE;
  if (decision.reason === "daily_limit") return AI_DAILY_LIMIT_MESSAGE;
  return "You're doing that too quickly. Please wait a moment and try again.";
}

/**
 * Route-handler form of `checkAiUsage`: returns a ready 429/503 response, or
 * `null` when the request may proceed.
 */
export async function enforceAiUsage(userId: string, rule: RateLimitRule) {
  const decision = await checkAiUsage(userId, rule);
  if (decision.allowed) return null;

  if (decision.reason === "unavailable") {
    return apiError("server_error", AI_UNAVAILABLE_MESSAGE, {
      status: 503,
      headers: { "Retry-After": "60" },
    });
  }

  const res = rateLimitedResponse(decision.result);
  if (decision.reason !== "daily_limit") return res;

  const retryAfter = res.headers.get("Retry-After") ?? "3600";
  return apiError("rate_limited", AI_DAILY_LIMIT_MESSAGE, {
    headers: res.headers,
    details: {
      limit: decision.result.limit,
      remaining: 0,
      resetAt: decision.result.resetAt,
      retryAfterSeconds: Number(retryAfter),
      scope: "daily",
    },
  });
}
