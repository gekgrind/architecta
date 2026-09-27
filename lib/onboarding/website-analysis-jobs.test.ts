import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeWebsiteAnalysisTable } from "@/test/onboarding/fake-website-analysis-table";

const h = vi.hoisted(() => ({
  prepare: vi.fn(),
  execute: vi.fn(),
  checkAiUsage: vi.fn(),
  serverClient: vi.fn(),
}));

vi.mock("./website-analysis", () => ({
  prepareWebsiteAnalysis: h.prepare,
  executeWebsiteAnalysis: h.execute,
}));
vi.mock("@/lib/ratelimit", () => ({
  RATE_LIMITS: { websiteAnalysis: { action: "onboarding.website_analysis", limit: 5, windowSeconds: 600 } },
  checkAiUsage: h.checkAiUsage,
  aiUsageDeniedMessage: () => "You're doing that too quickly. Please wait a moment and try again.",
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: h.serverClient }));
vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(async () => {
    throw new Error("tests must inject the fake table");
  }),
}));

import {
  claimWebsiteAnalysisJob,
  enqueueWebsiteAnalysis,
  findDueWebsiteAnalysisJobs,
  getWebsiteAnalysisForSession,
  isRetryableAnalysisFailure,
  MAX_WEBSITE_ANALYSIS_ATTEMPTS,
  normalizeWebsiteUrl,
  processWebsiteAnalysisJob,
  RATE_LIMIT_RETRY_DELAY_MS,
  RETRY_DELAY_MS,
  STALE_CLAIM_MS,
  sweepStaleWebsiteAnalysisJobs,
  websiteInputHash,
} from "./website-analysis-jobs";

const USER = "user-1";
const SESSION = "sess-1";
const URL_A = "https://acme.example.com";
const URL_B = "https://other.example.com";

const EVIDENCE = {
  url: URL_A,
  structuredBlock: "",
  content: "Acme designs content systems for founders.",
  fallback: {},
};
const ANALYSIS = { brand_name: "Acme", confidence: "high", analyzed_at: "2026-09-27T00:00:00.000Z" };

let table: ReturnType<typeof createFakeWebsiteAnalysisTable>;

beforeEach(() => {
  vi.resetAllMocks();
  table = createFakeWebsiteAnalysisTable();
  h.prepare.mockImplementation(async (url: string) => ({ ok: true, evidence: { ...EVIDENCE, url } }));
  h.checkAiUsage.mockResolvedValue({ allowed: true });
  h.execute.mockResolvedValue({ ok: true, analysis: ANALYSIS, model: "z-ai/glm-5.3" });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function enqueue(url = URL_A) {
  return enqueueWebsiteAnalysis({ userId: USER, sessionId: SESSION, url, supabase: table.client });
}

function process(jobId: string, now?: Date) {
  return processWebsiteAnalysisJob(jobId, { supabase: table.client, now: now ? () => now : undefined });
}

/* =======================================================
   Enqueue + idempotency
======================================================= */

describe("enqueueWebsiteAnalysis", () => {
  it("prepares evidence synchronously, checks AI usage, and queues one job without calling the model", async () => {
    const result = await enqueue();

    expect(result).toMatchObject({ ok: true, status: "queued", reused: false });
    const job = table.only();
    expect(job).toMatchObject({
      session_id: SESSION,
      user_id: USER,
      url: URL_A,
      input_hash: websiteInputHash(URL_A),
      status: "queued",
      attempts: 0,
    });
    expect(JSON.parse(job.evidence as string).content).toContain("content systems");
    expect(h.checkAiUsage).toHaveBeenCalledWith(USER, expect.objectContaining({ action: "onboarding.website_analysis" }));
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("is idempotent for the same normalized URL: no refetch, no extra usage, same job", async () => {
    const first = await enqueue(URL_A);
    const again = await enqueue("HTTPS://ACME.example.com/#top");

    expect(again).toMatchObject({ ok: true, reused: true });
    if (!first.ok || !again.ok) throw new Error("expected ok");
    expect(again.jobId).toBe(first.jobId);
    expect(h.prepare).toHaveBeenCalledTimes(1);
    expect(h.checkAiUsage).toHaveBeenCalledTimes(1);
    expect(table.rows.size).toBe(1);
  });

  it("re-queues a failed job when the user submits the same URL again", async () => {
    await enqueue();
    Object.assign(table.only(), { status: "failed", attempts: 3, error_code: "timeout" });

    const result = await enqueue();

    expect(result).toMatchObject({ ok: true, status: "queued", reused: false });
    expect(table.only()).toMatchObject({ status: "queued", attempts: 0, error_code: null });
  });

  it("resets the job for a different URL and fences out the old URL's worker", async () => {
    const first = await enqueue(URL_A);
    if (!first.ok) throw new Error("expected ok");

    // Worker for URL A is mid-attempt when the user changes the URL.
    h.execute.mockImplementationOnce(async () => {
      await enqueue(URL_B);
      return { ok: true, analysis: { ...ANALYSIS, brand_name: "Old URL result" }, model: "z-ai/glm-5.3" };
    });

    const outcome = await process(first.jobId);

    expect(outcome).toBe("superseded");
    expect(table.only()).toMatchObject({
      url: URL_B,
      input_hash: websiteInputHash(URL_B),
      status: "queued",
      attempts: 0,
      claim_token: null,
      result: null,
    });
  });

  it("returns the user-safe fetch error and creates no job when the site can't be read", async () => {
    h.prepare.mockResolvedValueOnce({ ok: false, error: "We couldn't read your website (HTTP 404: Not Found)." });

    const result = await enqueue();

    expect(result).toEqual({ ok: false, error: "We couldn't read your website (HTTP 404: Not Found)." });
    expect(table.rows.size).toBe(0);
    expect(h.checkAiUsage).not.toHaveBeenCalled();
  });

  it("creates no job when the AI usage limit denies the request", async () => {
    h.checkAiUsage.mockResolvedValueOnce({ allowed: false, reason: "rate_limited", result: {} });

    const result = await enqueue();

    expect(result.ok).toBe(false);
    expect(table.rows.size).toBe(0);
  });

  it("recovers from a concurrent enqueue that won the unique(session_id) race", async () => {
    // Another request inserts between our lookup and our insert.
    h.checkAiUsage.mockImplementationOnce(async () => {
      table.rows.set("job-race", {
        id: "job-race",
        session_id: SESSION,
        user_id: USER,
        url: URL_B,
        input_hash: websiteInputHash(URL_B),
        status: "queued",
        attempts: 0,
      });
      return { allowed: true };
    });

    const result = await enqueue(URL_A);

    expect(result).toMatchObject({ ok: true, jobId: "job-race", status: "queued" });
    expect(table.only()).toMatchObject({ url: URL_A, input_hash: websiteInputHash(URL_A) });
  });
});

/* =======================================================
   Claim
======================================================= */

describe("claimWebsiteAnalysisJob", () => {
  it("has exactly one winner for concurrent claims", async () => {
    const queued = await enqueue();
    if (!queued.ok) throw new Error("expected ok");
    const read = { id: queued.jobId, attempts: 0 };

    const [a, b] = await Promise.all([
      claimWebsiteAnalysisJob(table.client, read),
      claimWebsiteAnalysisJob(table.client, read),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(table.only()).toMatchObject({ status: "processing", attempts: 1, claim_token: a ?? b });
  });

  it("does not claim a job before next_attempt_at", async () => {
    const queued = await enqueue();
    if (!queued.ok) throw new Error("expected ok");
    table.only().next_attempt_at = new Date(Date.now() + 60_000).toISOString();

    expect(await claimWebsiteAnalysisJob(table.client, { id: queued.jobId, attempts: 0 })).toBeNull();
  });
});

/* =======================================================
   Process: one attempt, persisted retry state
======================================================= */

describe("processWebsiteAnalysisJob", () => {
  async function queuedJobId() {
    const queued = await enqueue();
    if (!queued.ok) throw new Error("expected ok");
    return queued.jobId;
  }

  it("completes: stores the validated result + model, clears evidence and the claim", async () => {
    const jobId = await queuedJobId();

    expect(await process(jobId)).toBe("completed");

    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute).toHaveBeenCalledWith(USER, expect.objectContaining({ url: URL_A }), { background: true });
    expect(table.only()).toMatchObject({
      status: "completed",
      result: ANALYSIS,
      model: "z-ai/glm-5.3",
      attempts: 1,
      evidence: null,
      claim_token: null,
      error_code: null,
    });
    expect(table.only().completed_at).toEqual(expect.any(String));
  });

  it("makes ONE model attempt and persists a retry for the cron on a timeout", async () => {
    const jobId = await queuedJobId();
    const now = new Date("2026-09-27T12:00:00.000Z");
    table.only().next_attempt_at = now.toISOString();
    h.execute.mockResolvedValueOnce({ ok: false, category: "timeout" });

    expect(await process(jobId, now)).toBe("retry_scheduled");

    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(table.only()).toMatchObject({
      status: "queued",
      attempts: 1,
      error_code: "timeout",
      claim_token: null,
      claimed_at: null,
      next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
    });
  });

  it("backs off ~5 minutes on an NVIDIA 429", async () => {
    const jobId = await queuedJobId();
    const now = new Date("2026-09-27T12:00:00.000Z");
    table.only().next_attempt_at = now.toISOString();
    h.execute.mockResolvedValueOnce({ ok: false, category: "rate_limit" });

    await process(jobId, now);

    expect(table.only().next_attempt_at).toBe(new Date(now.getTime() + RATE_LIMIT_RETRY_DELAY_MS).toISOString());
  });

  it.each(["configuration", "authentication", "quota", "invalid_request"] as const)(
    "fails permanently on %s without scheduling a retry",
    async (category) => {
      const jobId = await queuedJobId();
      h.execute.mockResolvedValueOnce({ ok: false, category });

      expect(await process(jobId)).toBe("failed");
      expect(table.only()).toMatchObject({ status: "failed", error_code: category, evidence: null });
    }
  );

  it("retries unparseable model output, then fails once attempts are exhausted", async () => {
    const jobId = await queuedJobId();
    h.execute.mockResolvedValue({ ok: false, category: "parse" });

    for (let attempt = 1; attempt < MAX_WEBSITE_ANALYSIS_ATTEMPTS; attempt++) {
      table.only().next_attempt_at = new Date(0).toISOString();
      expect(await process(jobId)).toBe("retry_scheduled");
    }
    table.only().next_attempt_at = new Date(0).toISOString();
    expect(await process(jobId)).toBe("failed");

    expect(h.execute).toHaveBeenCalledTimes(MAX_WEBSITE_ANALYSIS_ATTEMPTS);
    expect(table.only()).toMatchObject({ status: "failed", attempts: MAX_WEBSITE_ANALYSIS_ATTEMPTS, error_code: "parse" });
  });

  it("treats an unexpected exception as a retryable attempt", async () => {
    const jobId = await queuedJobId();
    h.execute.mockRejectedValueOnce(new Error("boom"));

    expect(await process(jobId)).toBe("retry_scheduled");
    expect(table.only()).toMatchObject({ status: "queued", error_code: "unknown" });
  });

  it("skips jobs that are not due, not queued, or missing", async () => {
    const jobId = await queuedJobId();
    table.only().next_attempt_at = new Date(Date.now() + 60_000).toISOString();
    expect(await process(jobId)).toBe("skipped");

    table.only().status = "completed";
    expect(await process(jobId)).toBe("skipped");
    expect(await process("missing")).toBe("skipped");
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("a duplicate worker invocation cannot run a second model call", async () => {
    const jobId = await queuedJobId();

    const outcomes = await Promise.all([process(jobId), process(jobId)]);

    expect(outcomes.sort()).toEqual(["completed", "skipped"]);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it("fences the final write: a stale-requeued claim cannot overwrite the newer claim", async () => {
    const jobId = await queuedJobId();
    h.execute.mockImplementationOnce(async () => {
      // While this worker hangs, its claim is swept and re-claimed elsewhere.
      Object.assign(table.only(), { status: "processing", claim_token: "newer-claim" });
      return { ok: true, analysis: { ...ANALYSIS, brand_name: "Stale worker" }, model: "z-ai/glm-5.3" };
    });

    expect(await process(jobId)).toBe("superseded");
    expect(table.only()).toMatchObject({ status: "processing", claim_token: "newer-claim", result: null });
  });

  it("never writes onboarding answers — only the job table", async () => {
    const jobId = await queuedJobId();

    // The fake client throws for any table but the job table, so completing
    // proves the worker touched nothing else (e.g. onboarding_sessions).
    expect(await process(jobId)).toBe("completed");
    expect(table.writes.length).toBeGreaterThan(0);

    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.resolve(__dirname, "./website-analysis-jobs.ts"), "utf-8");
    expect(source).not.toContain('from("onboarding_sessions")');
    expect(source).not.toContain("saveOnboardingProgress");
  });
});

/* =======================================================
   Stale recovery + due selection
======================================================= */

describe("sweepStaleWebsiteAnalysisJobs", () => {
  it("re-queues stale claims with attempts left, fails exhausted ones, and leaves fresh claims alone", async () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const stale = new Date(now.getTime() - STALE_CLAIM_MS - 1_000).toISOString();
    const fresh = new Date(now.getTime() - 30_000).toISOString();
    const base = { user_id: USER, url: URL_A, input_hash: "h", status: "processing", evidence: "{}" };
    table.rows.set("a", { ...base, id: "a", session_id: "s-a", attempts: 1, claimed_at: stale, claim_token: "t-a" });
    table.rows.set("b", { ...base, id: "b", session_id: "s-b", attempts: 3, claimed_at: stale, claim_token: "t-b" });
    table.rows.set("c", { ...base, id: "c", session_id: "s-c", attempts: 1, claimed_at: fresh, claim_token: "t-c" });

    const result = await sweepStaleWebsiteAnalysisJobs(table.client, now);

    expect(result).toEqual({ requeued: 1, failed: 1 });
    expect(table.rows.get("a")).toMatchObject({ status: "queued", claim_token: null, error_code: "stale" });
    expect(table.rows.get("b")).toMatchObject({ status: "failed", error_code: "stale", evidence: null });
    expect(table.rows.get("c")).toMatchObject({ status: "processing", claim_token: "t-c" });
  });
});

describe("findDueWebsiteAnalysisJobs", () => {
  it("returns due queued jobs oldest first, bounded by the limit", async () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
    const base = { user_id: USER, url: URL_A, input_hash: "h", attempts: 1 };
    table.rows.set("late", { ...base, id: "late", session_id: "1", status: "queued", next_attempt_at: at(-1_000) });
    table.rows.set("early", { ...base, id: "early", session_id: "2", status: "queued", next_attempt_at: at(-60_000) });
    table.rows.set("future", { ...base, id: "future", session_id: "3", status: "queued", next_attempt_at: at(60_000) });
    table.rows.set("done", { ...base, id: "done", session_id: "4", status: "completed", next_attempt_at: at(-60_000) });
    table.rows.set("mid", { ...base, id: "mid", session_id: "5", status: "queued", next_attempt_at: at(-30_000) });

    expect(await findDueWebsiteAnalysisJobs(table.client, 2, now)).toEqual(["early", "mid"]);
  });
});

/* =======================================================
   Classification + normalization
======================================================= */

describe("retry classification", () => {
  it("retries transient failures and never permanent ones", () => {
    for (const c of ["timeout", "rate_limit", "provider", "network", "parse", "unknown"] as const) {
      expect(isRetryableAnalysisFailure(c)).toBe(true);
    }
    for (const c of ["configuration", "authentication", "quota", "invalid_request"] as const) {
      expect(isRetryableAnalysisFailure(c)).toBe(false);
    }
  });
});

describe("normalizeWebsiteUrl", () => {
  it("treats case, fragments and a trailing slash as the same site, but not a different path", () => {
    expect(normalizeWebsiteUrl("https://Acme.Example.com/")).toBe(normalizeWebsiteUrl("https://acme.example.com#x"));
    expect(normalizeWebsiteUrl("https://acme.example.com/about/")).toBe("https://acme.example.com/about");
    expect(normalizeWebsiteUrl("https://acme.example.com/about")).not.toBe(normalizeWebsiteUrl("https://acme.example.com"));
  });
});

/* =======================================================
   Read-time status (user session client)
======================================================= */

describe("getWebsiteAnalysisForSession", () => {
  function userClient(result: { data: unknown; error: unknown }) {
    const select = vi.fn(() => chain);
    const chain = {
      select,
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => result),
    };
    h.serverClient.mockResolvedValue({ from: vi.fn(() => chain) });
    return select;
  }

  it("reads only status/result (never evidence or error details) and exposes a completed result", async () => {
    const select = userClient({ data: { status: "completed", result: ANALYSIS }, error: null });

    expect(await getWebsiteAnalysisForSession(SESSION)).toEqual({ status: "completed", result: ANALYSIS });
    expect(select).toHaveBeenCalledWith("status, result");
  });

  it("hides the result until the job is completed", async () => {
    userClient({ data: { status: "processing", result: null }, error: null });
    expect(await getWebsiteAnalysisForSession(SESSION)).toEqual({ status: "processing", result: null });
  });

  it("returns null (onboarding continues) when the table is unavailable", async () => {
    userClient({ data: null, error: { message: 'relation "architecta_website_analyses" does not exist' } });
    expect(await getWebsiteAnalysisForSession(SESSION)).toBeNull();
  });
});
