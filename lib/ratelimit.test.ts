import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import {
  checkRateLimit,
  enforceRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "./ratelimit";

const RULE = { action: "test.action", limit: 5, windowSeconds: 60 };

beforeEach(() => {
  rpcMock.mockReset();
});

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
