import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeWebsiteAnalysisTable } from "@/test/onboarding/fake-website-analysis-table";

const h = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: h.createSupabaseServiceClient,
}));
// The real job module runs; only the model call itself is doubled.
vi.mock("@/lib/onboarding/website-analysis", () => ({
  prepareWebsiteAnalysis: vi.fn(),
  executeWebsiteAnalysis: h.execute,
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";

function req(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/website-analysis", { method: "POST", headers });
}

function queuedJob(id: string, nextAttemptAt: string, attempts = 1) {
  return {
    id,
    session_id: `sess-${id}`,
    user_id: `user-${id}`,
    url: "https://acme.example.com",
    input_hash: "h",
    evidence: JSON.stringify({ url: "https://acme.example.com", content: "Acme content", structuredBlock: "", fallback: {} }),
    status: "queued",
    attempts,
    next_attempt_at: nextAttemptAt,
    claimed_at: null,
    claim_token: null,
    result: null,
  };
}

let table: ReturnType<typeof createFakeWebsiteAnalysisTable>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  table = createFakeWebsiteAnalysisTable();
  h.createSupabaseServiceClient.mockResolvedValue(table.client);
  h.execute.mockResolvedValue({
    ok: true,
    analysis: { brand_name: "Acme", confidence: "high", analyzed_at: "2026-09-27T00:00:00.000Z" },
    model: "z-ai/glm-5.3",
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/cron/website-analysis — auth", () => {
  it("rejects a request without the secret", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("rejects an incorrect secret", async () => {
    const res = await POST(req("wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await POST(req(""));
    expect(res.status).toBe(401);
    expect(h.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("accepts the correct secret", async () => {
    const res = await POST(req(SECRET));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/cron/website-analysis — processing", () => {
  it("recovers stale claims, then processes a small batch of due jobs sequentially", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    table.rows.set("a", queuedJob("a", past));
    table.rows.set("b", queuedJob("b", past));
    table.rows.set("c", queuedJob("c", past));
    table.rows.set("future", queuedJob("future", new Date(Date.now() + 60 * 60_000).toISOString()));
    table.rows.set("stuck", {
      ...queuedJob("stuck", past),
      status: "processing",
      claimed_at: stale,
      claim_token: "old-claim",
    });

    let inFlight = 0;
    let maxInFlight = 0;
    h.execute.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true, analysis: { confidence: "high", analyzed_at: "x" }, model: "z-ai/glm-5.3" };
    });

    const res = await POST(req(SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.stale).toEqual({ requeued: 1, failed: 0 });
    // Bounded batch, one at a time; the future job is left alone.
    expect(h.execute).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
    expect(body.data).toMatchObject({ scanned: 2, completed: 2, errors: 0 });
    expect(table.rows.get("future")?.status).toBe("queued");
    // Model calls are attributed to each job's own user as background calls.
    expect(h.execute.mock.calls.map(([userId, , opts]) => [userId, opts])).toEqual(
      expect.arrayContaining([["user-a", { background: true }]])
    );
  });

  it("returns aggregate counts only — no URLs, evidence, results or user ids", async () => {
    table.rows.set("a", queuedJob("a", new Date(0).toISOString()));

    const res = await POST(req(SECRET));
    const text = JSON.stringify(await res.json());

    expect(text).not.toContain("acme.example.com");
    expect(text).not.toContain("Acme content");
    expect(text).not.toContain("user-a");
  });
});
