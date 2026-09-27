import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  checkAiUsage: vi.fn(),
  runGateway: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: h.getUser } })),
}));
vi.mock("@/lib/ratelimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ratelimit")>("@/lib/ratelimit");
  return {
    checkAiUsage: h.checkAiUsage,
    aiUsageDeniedMessage: actual.aiUsageDeniedMessage,
    RATE_LIMITS: actual.RATE_LIMITS,
  };
});
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));

import { getOnboardingSuggestions } from "@/lib/ai/onboardingSuggestions";

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "user-s" } } });
  h.runGateway.mockResolvedValue({ text: "suggestion" });
});

describe("getOnboardingSuggestions AI guard", () => {
  it("checks the onboarding-suggestion limit for the signed-in user", async () => {
    h.checkAiUsage.mockResolvedValue({ allowed: true });

    const result = await getOnboardingSuggestions({ step: "brand", context: {} });

    expect(result).toEqual({ ok: true, suggestions: "suggestion" });
    expect(h.checkAiUsage).toHaveBeenCalledWith(
      "user-s",
      expect.objectContaining({ action: "onboarding.suggest" })
    );
  });

  it("returns a controlled error and never calls the gateway when limited", async () => {
    h.checkAiUsage.mockResolvedValue({
      allowed: false,
      reason: "daily_limit",
      result: { allowed: false, remaining: 0, resetAt: null, limit: 50 },
    });

    const result = await getOnboardingSuggestions({ step: "brand", context: {} });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/today's AI usage limit/);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("does not touch the limiter for unauthenticated callers", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const result = await getOnboardingSuggestions({ step: "brand", context: {} });
    expect(result).toEqual({ ok: false, error: "Not authenticated" });
    expect(h.checkAiUsage).not.toHaveBeenCalled();
  });
});
