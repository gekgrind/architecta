import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import {
  aiDailyBudgetRule,
  aiUsageDeniedMessage,
  checkAiUsage,
  checkRateLimit,
  DEFAULT_AI_DAILY_REQUEST_LIMIT,
  enforceAiUsage,
  enforceRateLimit,
  getAiDailyRequestLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "./ratelimit";

const RULE = { action: "test.action", limit: 5, windowSeconds: 60 };

beforeEach(() => {
  rpcMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("AI_DAILY_REQUEST_LIMIT", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const ALLOW = { data: [{ allowed: true, remaining: 3, reset_at: null }], error: null };
const DENY = {
  data: [{ allowed: false, remaining: 0, reset_at: new Date(Date.now() + 30_000).toISOString() }],
  error: null,
};

describe("checkRateLimit", () => {
  it("passes a server-derived key to the RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, remaining: 4, reset_at: null }],
      error: null,
    });
    await checkRateLimit("user-123", RULE);
    expect(rpcMock).toHaveBeenCalledWith("architecta_check_rate_limit", {
      p_key: "test.action:user-123",
      p_limit: 5,
      p_window_seconds: 60,
    });
  });

  it("returns allowed when the RPC allows", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, remaining: 3, reset_at: "2026-06-24T00:00:00Z" }],
      error: null,
    });
    const result = await checkRateLimit("u", RULE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("returns blocked when the RPC denies", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: "2026-06-24T00:00:00Z" }],
      error: null,
    });
    const result = await checkRateLimit("u", RULE);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("fails OPEN when the RPC returns an error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await checkRateLimit("u", RULE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RULE.limit);
  });

  it("fails OPEN when the RPC throws", async () => {
    rpcMock.mockRejectedValue(new Error("network down"));
    const result = await checkRateLimit("u", RULE);
    expect(result.allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("returns null when allowed", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, remaining: 2, reset_at: null }],
      error: null,
    });
    expect(await enforceRateLimit("u", RULE)).toBeNull();
  });

  it("returns a 429 response when blocked", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: new Date(Date.now() + 30_000).toISOString() }],
      error: null,
    });
    const res = await enforceRateLimit("u", RULE);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
  });
});

describe("rateLimitedResponse", () => {
  it("sets 429, Retry-After and X-RateLimit headers", async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    const res = rateLimitedResponse({ allowed: false, remaining: 0, resetAt, limit: 5 });

    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(resetAt);

    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("rate_limited");
  });

  it("defaults Retry-After to 60 when no resetAt", () => {
    const res = rateLimitedResponse({ allowed: false, remaining: 0, resetAt: null, limit: 10 });
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

describe("RATE_LIMITS", () => {
  it("defines a rule for every AI action with sane values", () => {
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
      expect(rule.action).toMatch(/\w+\.\w+/);
    }
  });
});

describe("checkRateLimit failClosed", () => {
  it("denies when the RPC returns an error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await checkRateLimit("u", RULE, { failClosed: true });
    expect(result.allowed).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("denies when the RPC throws", async () => {
    rpcMock.mockRejectedValue(new Error("network down"));
    const result = await checkRateLimit("u", RULE, { failClosed: true });
    expect(result.allowed).toBe(false);
  });

  it("denies when the RPC returns no row", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const result = await checkRateLimit("u", RULE, { failClosed: true });
    expect(result.allowed).toBe(false);
  });

  it("leaves the default (non-AI) behaviour fail-open", async () => {
    rpcMock.mockRejectedValue(new Error("network down"));
    expect((await checkRateLimit("u", RATE_LIMITS.publish)).allowed).toBe(true);
  });
});

describe("daily AI budget", () => {
  it("defaults to a conservative limit", () => {
    expect(DEFAULT_AI_DAILY_REQUEST_LIMIT).toBe(50);
    expect(getAiDailyRequestLimit()).toBe(50);
  });

  it("is configurable server-side via AI_DAILY_REQUEST_LIMIT", () => {
    vi.stubEnv("AI_DAILY_REQUEST_LIMIT", "10");
    expect(getAiDailyRequestLimit()).toBe(10);
  });

  it("ignores invalid overrides", () => {
    for (const bad of ["0", "-3", "abc", "2.5"]) {
      vi.stubEnv("AI_DAILY_REQUEST_LIMIT", bad);
      expect(getAiDailyRequestLimit()).toBe(50);
    }
  });

  it("keys the bucket by UTC day so it resets at 00:00 UTC", () => {
    const late = aiDailyBudgetRule(new Date("2026-09-26T23:59:59Z"));
    const next = aiDailyBudgetRule(new Date("2026-09-27T00:00:01Z"));
    expect(late.action).toBe("ai.daily.2026-09-26");
    expect(next.action).toBe("ai.daily.2026-09-27");
    expect(late.windowSeconds).toBe(86_400);
  });
});

describe("checkAiUsage", () => {
  const NOW = new Date("2026-09-26T12:00:00Z");

  it("checks the action limit and then the per-user daily budget", async () => {
    rpcMock.mockResolvedValue(ALLOW);
    const decision = await checkAiUsage("user-9", RATE_LIMITS.postGenerate, NOW);
    expect(decision.allowed).toBe(true);
    expect(rpcMock.mock.calls.map(([, a]) => a.p_key)).toEqual([
      "posts.generate:user-9",
      "ai.daily.2026-09-26:user-9",
    ]);
    expect(rpcMock.mock.calls[1][1].p_limit).toBe(50);
  });

  it("reports rate_limited without consuming the daily budget", async () => {
    rpcMock.mockResolvedValueOnce(DENY);
    const decision = await checkAiUsage("u", RATE_LIMITS.postGenerate, NOW);
    expect(decision).toMatchObject({ allowed: false, reason: "rate_limited" });
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("reports daily_limit with a reset at the next UTC midnight", async () => {
    rpcMock.mockResolvedValueOnce(ALLOW).mockResolvedValueOnce(DENY);
    const decision = await checkAiUsage("u", RATE_LIMITS.postGenerate, NOW);
    expect(decision).toMatchObject({ allowed: false, reason: "daily_limit" });
    if (decision.allowed) return;
    expect(decision.result.resetAt).toBe("2026-09-27T00:00:00.000Z");
    expect(aiUsageDeniedMessage(decision)).toMatch(/today's AI usage limit/);
  });

  it("fails closed when the limiter is down", async () => {
    rpcMock.mockRejectedValue(new Error("db down"));
    const decision = await checkAiUsage("u", RATE_LIMITS.postGenerate, NOW);
    expect(decision).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it("fails closed when only the daily-budget check errors", async () => {
    rpcMock.mockResolvedValueOnce(ALLOW).mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const decision = await checkAiUsage("u", RATE_LIMITS.postGenerate, NOW);
    expect(decision).toMatchObject({ allowed: false, reason: "unavailable" });
  });
});

describe("enforceAiUsage", () => {
  it("returns null when allowed", async () => {
    rpcMock.mockResolvedValue(ALLOW);
    expect(await enforceAiUsage("u", RATE_LIMITS.postGenerate)).toBeNull();
  });

  it("returns 429 for the per-action limit", async () => {
    rpcMock.mockResolvedValue(DENY);
    const res = await enforceAiUsage("u", RATE_LIMITS.postGenerate);
    expect(res!.status).toBe(429);
  });

  it("returns 429 with a daily-scope body when the budget is exhausted", async () => {
    rpcMock.mockResolvedValueOnce(ALLOW).mockResolvedValueOnce(DENY);
    const res = await enforceAiUsage("u", RATE_LIMITS.postGenerate);
    expect(res!.status).toBe(429);
    const body = (await res!.json()) as {
      error: { code: string; message: string; details: { scope: string } };
    };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.details.scope).toBe("daily");
    expect(Number(res!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("returns 503 (not a pass) when the limiter errors, without internal details", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const res = await enforceAiUsage("u", RATE_LIMITS.postGenerate);
    expect(res!.status).toBe(503);
    const text = await res!.text();
    expect(text).not.toContain("relation does not exist");
  });
});
