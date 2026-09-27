import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { aiUsageDeniedMessage, checkAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { WebsiteAnalysisResult } from "./persistence";
import {
  executeWebsiteAnalysis,
  prepareWebsiteAnalysis,
  type WebsiteAnalysisEvidence,
  type WebsiteAnalysisFailure,
} from "./website-analysis";

/* =======================================================
   Background website analysis jobs

   One durable job per onboarding session in architecta_website_analyses.
   The onboarding request prepares evidence and queues the job; the model
   call runs later (after() fast path, then the authenticated cron backstop).

   Reliability follows the publishing pattern: an atomic conditional claim
   (one winner), a per-claim token that fences every final write, and stale
   claim recovery. Unlike publishing, analysis has no external side effects,
   so a stale claim is safely re-queued while attempts remain.

   Results are stored ONLY in this table and never written into
   onboarding_sessions.answers — see composeWebsiteAnalysis().
======================================================= */

export const WEBSITE_ANALYSIS_TABLE = "architecta_website_analyses";

/** Total model attempts per job (attempt 1 via after(), 2–3 via cron). */
export const MAX_WEBSITE_ANALYSIS_ATTEMPTS = 3;
/** Delay before a retryable failure is due again (next cron run picks it up). */
export const RETRY_DELAY_MS = 60_000;
/** NVIDIA 429: back off longer so shared capacity isn't hammered. */
export const RATE_LIMIT_RETRY_DELAY_MS = 5 * 60_000;
/** A processing claim older than this lost its worker (90s attempt + margin). */
export const STALE_CLAIM_MS = 5 * 60_000;

export type WebsiteAnalysisJobStatus = "queued" | "processing" | "completed" | "failed";

type Db = SupabaseClient;

// Retrying cannot fix these: bad config/credentials/billing or a request the
// provider rejects. Everything else (timeout, 429, 5xx, network, unparseable
// output, unknown) gets another bounded attempt.
const PERMANENT_FAILURES = new Set<WebsiteAnalysisFailure>([
  "configuration",
  "authentication",
  "quota",
  "invalid_request",
]);

export function isRetryableAnalysisFailure(category: WebsiteAnalysisFailure): boolean {
  return !PERMANENT_FAILURES.has(category);
}

export function retryDelayMs(category: WebsiteAnalysisFailure): number {
  return category === "rate_limit" ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS;
}

/** Same site → same hash: scheme/host case, fragment and trailing slash don't matter. */
export function normalizeWebsiteUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${parsed.protocol}//${parsed.host}${path === "/" ? "" : path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function websiteInputHash(url: string): string {
  return createHash("sha256").update(normalizeWebsiteUrl(url)).digest("hex");
}

function parseEvidence(raw: string | null): WebsiteAnalysisEvidence | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WebsiteAnalysisEvidence>;
    if (typeof value.url !== "string" || typeof value.content !== "string") return null;
    return {
      url: value.url,
      content: value.content,
      structuredBlock: typeof value.structuredBlock === "string" ? value.structuredBlock : "",
      fallback: value.fallback && typeof value.fallback === "object" ? value.fallback : {},
    };
  } catch {
    return null;
  }
}

/* =======================================================
   Enqueue (onboarding request, authenticated user)
======================================================= */

export type EnqueueResult =
  | { ok: true; jobId: string; status: WebsiteAnalysisJobStatus; reused: boolean }
  | { ok: false; error: string };

/**
 * Validates + fetches the site synchronously (SSRF-checked), checks the user's
 * AI allowance, and creates/resets the session's single job. Re-submitting the
 * same URL while a job is queued/processing/completed is a no-op (no refetch,
 * no extra model spend). A different URL resets the job: attempts go back to 0
 * and the claim token is cleared, which fences out any worker still running on
 * the old URL.
 *
 * `userId` and `sessionId` must come from the authenticated session, never
 * from client input.
 */
export async function enqueueWebsiteAnalysis(args: {
  userId: string;
  sessionId: string;
  url: string;
  supabase?: Db;
}): Promise<EnqueueResult> {
  const supabase = args.supabase ?? (await createSupabaseServiceClient());
  const inputHash = websiteInputHash(args.url);

  const { data: existing, error: lookupError } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .select("id, status, input_hash")
    .eq("session_id", args.sessionId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (lookupError) throw new Error(`website analysis lookup failed: ${lookupError.message}`);

  if (existing && existing.input_hash === inputHash && existing.status !== "failed") {
    return { ok: true, jobId: existing.id, status: existing.status as WebsiteAnalysisJobStatus, reused: true };
  }

  const prepared = await prepareWebsiteAnalysis(args.url);
  if (!prepared.ok) return { ok: false, error: prepared.error };

  // Per-user limit + daily budget, once per queued analysis. A job's retries
  // are bounded by MAX_WEBSITE_ANALYSIS_ATTEMPTS instead of re-checking.
  const allowance = await checkAiUsage(args.userId, RATE_LIMITS.websiteAnalysis);
  if (!allowance.allowed) return { ok: false, error: aiUsageDeniedMessage(allowance) };

  const fresh = {
    url: args.url,
    input_hash: inputHash,
    evidence: JSON.stringify(prepared.evidence),
    status: "queued" as const,
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
    claimed_at: null,
    claim_token: null,
    completed_at: null,
    error_code: null,
    result: null,
    model: null,
  };

  const reset = async (id: string) => {
    const { error } = await supabase
      .from(WEBSITE_ANALYSIS_TABLE)
      .update(fresh)
      .eq("id", id)
      .eq("user_id", args.userId);
    if (error) throw new Error(`website analysis reset failed: ${error.message}`);
    return id;
  };

  if (existing) {
    return { ok: true, jobId: await reset(existing.id), status: "queued", reused: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .insert({ ...fresh, session_id: args.sessionId, user_id: args.userId })
    .select("id")
    .single();

  if (insertError) {
    // A concurrent enqueue for the same session won the unique(session_id) race.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from(WEBSITE_ANALYSIS_TABLE)
        .select("id")
        .eq("session_id", args.sessionId)
        .eq("user_id", args.userId)
        .maybeSingle();
      if (raced) return { ok: true, jobId: await reset(raced.id), status: "queued", reused: false };
    }
    throw new Error(`website analysis insert failed: ${insertError.message}`);
  }

  return { ok: true, jobId: inserted.id, status: "queued", reused: false };
}

/* =======================================================
   Claim (atomic, one winner)
======================================================= */

/**
 * Moves a due queued job to processing under a fresh claim token. The update
 * matches only while the row is still queued, due, and at the attempt count
 * the caller read, so concurrent workers (after() + cron, two cron runs)
 * cannot both win. Returns the claim token, or null if another worker won.
 */
export async function claimWebsiteAnalysisJob(
  supabase: Db,
  job: { id: string; attempts: number },
  now: Date = new Date()
): Promise<string | null> {
  const token = randomUUID();
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .update({
      status: "processing",
      claimed_at: nowIso,
      claim_token: token,
      attempts: job.attempts + 1,
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .eq("attempts", job.attempts)
    .lte("next_attempt_at", nowIso)
    .select("id");
  if (error) throw new Error(`website analysis claim failed: ${error.message}`);
  return (data?.length ?? 0) > 0 ? token : null;
}

/* =======================================================
   Process (one model attempt; never sleeps or loops)
======================================================= */

export type ProcessOutcome =
  | "completed"
  | "retry_scheduled"
  | "failed"
  | "skipped" // not due, not queued, or another worker won the claim
  | "superseded"; // lost the fence (URL changed or stale-requeued mid-attempt)

type JobRow = {
  id: string;
  user_id: string;
  status: string;
  attempts: number;
  next_attempt_at: string;
  evidence: string | null;
};

/**
 * Makes at most ONE model attempt for a job. A retryable failure is persisted
 * as queued with a later next_attempt_at for the cron processor; nothing here
 * waits or retries in-process, so an after() callback stays bounded by a
 * single provider attempt.
 */
export async function processWebsiteAnalysisJob(
  jobId: string,
  deps: { supabase?: Db; now?: () => Date } = {}
): Promise<ProcessOutcome> {
  const supabase = deps.supabase ?? (await createSupabaseServiceClient());
  const now = deps.now ?? (() => new Date());

  const { data, error } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .select("id, user_id, status, attempts, next_attempt_at, evidence")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(`website analysis load failed: ${error.message}`);

  const job = data as JobRow | null;
  if (!job || job.status !== "queued") return "skipped";
  if (new Date(job.next_attempt_at).getTime() > now().getTime()) return "skipped";

  const evidence = parseEvidence(job.evidence);
  if (job.attempts >= MAX_WEBSITE_ANALYSIS_ATTEMPTS || !evidence) {
    await supabase
      .from(WEBSITE_ANALYSIS_TABLE)
      .update({
        status: "failed",
        error_code: evidence ? "attempts_exhausted" : "invalid_evidence",
        evidence: null,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .eq("attempts", job.attempts);
    return "failed";
  }

  const token = await claimWebsiteAnalysisJob(supabase, job, now());
  if (!token) return "skipped";

  const attempt = job.attempts + 1;
  let outcome: Awaited<ReturnType<typeof executeWebsiteAnalysis>>;
  try {
    outcome = await executeWebsiteAnalysis(job.user_id, evidence, { background: true });
  } catch (err) {
    console.error("[website-analysis-job] unexpected attempt failure", {
      jobId: job.id,
      attempt,
      error: err instanceof Error ? err.name : "unknown",
    });
    outcome = { ok: false, category: "unknown" };
  }

  const finishedAt = now();
  let update: Record<string, unknown>;
  let result: ProcessOutcome;

  if (outcome.ok) {
    update = {
      status: "completed",
      result: outcome.analysis,
      model: outcome.model,
      completed_at: finishedAt.toISOString(),
      error_code: null,
      evidence: null,
      claim_token: null,
    };
    result = "completed";
  } else if (isRetryableAnalysisFailure(outcome.category) && attempt < MAX_WEBSITE_ANALYSIS_ATTEMPTS) {
    update = {
      status: "queued",
      next_attempt_at: new Date(finishedAt.getTime() + retryDelayMs(outcome.category)).toISOString(),
      claimed_at: null,
      claim_token: null,
      error_code: outcome.category,
    };
    result = "retry_scheduled";
  } else {
    update = { status: "failed", error_code: outcome.category, evidence: null, claim_token: null };
    result = "failed";
  }

  // Fence: only the claim that started this attempt may record its outcome.
  const { data: written, error: writeError } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .update(update)
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("claim_token", token)
    .select("id");
  if (writeError) throw new Error(`website analysis write failed: ${writeError.message}`);

  if ((written?.length ?? 0) === 0) return "superseded";

  console.info("[website-analysis-job] attempt finished", {
    jobId: job.id,
    attempt,
    outcome: result,
    category: outcome.ok ? null : outcome.category,
  });
  return result;
}

/* =======================================================
   Stale recovery + due-job selection (cron)
======================================================= */

/**
 * Processing claims older than STALE_CLAIM_MS lost their worker (PM2 restart,
 * deploy, crash). Analysis is side-effect free, so they're re-queued while
 * attempts remain and failed once attempts are exhausted.
 */
export async function sweepStaleWebsiteAnalysisJobs(
  supabase: Db,
  now: Date = new Date()
): Promise<{ requeued: number; failed: number }> {
  const cutoff = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();

  const { data: requeued, error: requeueError } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .update({
      status: "queued",
      claimed_at: null,
      claim_token: null,
      next_attempt_at: now.toISOString(),
      error_code: "stale",
    })
    .eq("status", "processing")
    .lt("claimed_at", cutoff)
    .lt("attempts", MAX_WEBSITE_ANALYSIS_ATTEMPTS)
    .select("id");
  if (requeueError) throw new Error(`website analysis stale requeue failed: ${requeueError.message}`);

  const { data: failed, error: failError } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .update({ status: "failed", claim_token: null, error_code: "stale", evidence: null })
    .eq("status", "processing")
    .lt("claimed_at", cutoff)
    .gte("attempts", MAX_WEBSITE_ANALYSIS_ATTEMPTS)
    .select("id");
  if (failError) throw new Error(`website analysis stale fail failed: ${failError.message}`);

  return { requeued: requeued?.length ?? 0, failed: failed?.length ?? 0 };
}

/** Ids of queued jobs that are due now, oldest first. */
export async function findDueWebsiteAnalysisJobs(
  supabase: Db,
  limit: number,
  now: Date = new Date()
): Promise<string[]> {
  const { data, error } = await supabase
    .from(WEBSITE_ANALYSIS_TABLE)
    .select("id")
    .eq("status", "queued")
    .lte("next_attempt_at", now.toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`website analysis due lookup failed: ${error.message}`);
  return (data ?? []).map((row: { id: string }) => row.id);
}

/* =======================================================
   Read-time status/result (signed-in user)
======================================================= */

export type WebsiteAnalysisSnapshot = {
  status: WebsiteAnalysisJobStatus;
  result: WebsiteAnalysisResult | null;
};

/**
 * The user's own job for their onboarding session, read with the user's
 * session client: RLS (owner-only) and the table's column grants apply, so
 * evidence and internal error details are never selectable here. Returns null
 * when there is no job or the table is unavailable — onboarding carries on.
 */
export async function getWebsiteAnalysisForSession(
  sessionId: string
): Promise<WebsiteAnalysisSnapshot | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(WEBSITE_ANALYSIS_TABLE)
      .select("status, result")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error || !data) return null;

    const status = data.status as WebsiteAnalysisJobStatus;
    const result =
      status === "completed" && data.result && typeof data.result === "object" && !Array.isArray(data.result)
        ? (data.result as WebsiteAnalysisResult)
        : null;
    return { status, result };
  } catch {
    return null;
  }
}
