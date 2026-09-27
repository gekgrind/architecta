import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ logLlmCall: vi.fn() }));
vi.mock("./usage/logger", () => ({ logLlmCall: h.logLlmCall }));

import { AiGatewayError, LlmProviderError } from "./errors";
import { createLlmGateway, MAX_FALLBACK_ATTEMPTS, MAX_PRIMARY_ATTEMPTS } from "./gateway";
import { MAX_OUTPUT_TOKENS } from "./policy";
import type { LlmClient, LlmGenerateInput, LlmPreference, LlmProvider, LlmResult } from "./types";

/**
 * Gateway attempt sequences with fake provider clients. No network, no keys.
 */

type Call = { provider: LlmProvider; model: string; maxTokens?: number };

function fakeClient(provider: LlmProvider, calls: Call[]) {
  const impl = vi.fn(
    async (input: Omit<LlmGenerateInput, "preference"> & { model: string }): Promise<LlmResult> => ({
      provider,
      model: input.model,
      text: `${provider}-ok`,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    })
  );
  const client: LlmClient = {
    provider,
    generate: async (input) => {
      calls.push({ provider, model: input.model, maxTokens: input.maxTokens });
      return impl(input);
    },
  };
  return { client, impl };
}

function setup(pref: {
  preference?: LlmPreference;
  anthropicModel?: string;
  openaiTextModel?: string;
} = {}) {
  const calls: Call[] = [];
  const openai = fakeClient("openai", calls);
  const anthropic = fakeClient("anthropic", calls);
  const nvidia = fakeClient("nvidia", calls);
  const getUserPreference = vi.fn(async () => ({
    preference: pref.preference ?? ("auto" as LlmPreference),
    anthropicModel: pref.anthropicModel ?? "claude-sonnet-4-6",
    openaiTextModel: pref.openaiTextModel ?? "gpt-4o",
  }));
  const gateway = createLlmGateway({
    openai: openai.client,
    anthropic: anthropic.client,
    nvidia: nvidia.client,
    getUserPreference,
    sleep: async () => {},
  });
  const count = (p: LlmProvider) => calls.filter((c) => c.provider === p).length;
  return { gateway, calls, count, openai, anthropic, nvidia, getUserPreference };
}

function input(overrides: Partial<LlmGenerateInput> = {}): LlmGenerateInput {
  return {
    userId: "user-1",
    workspaceId: "user-1",
    task: "POST_GENERATION",
    messages: [{ role: "user", content: "hi" }],
    ...overrides,
  };
}

function statusError(provider: LlmProvider, status: number, raw?: unknown) {
  return Object.assign(new Error(`${provider} ${status}`), { status, raw });
}

beforeEach(() => {
  vi.stubEnv("AI_TEST_PROVIDER", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* =======================================================
   NVIDIA-only test mode
======================================================= */

describe("NVIDIA-only mode (AI_TEST_PROVIDER=nvidia)", () => {
  beforeEach(() => vi.stubEnv("AI_TEST_PROVIDER", "nvidia"));

  it("routes a normally-paid text task to NVIDIA and nothing else", async () => {
    const t = setup();
    const result = await t.gateway.generate(input({ task: "CAMPAIGN_PLAN", tier: "premium" }));

    expect(result.provider).toBe("nvidia");
    expect(t.calls).toEqual([{ provider: "nvidia", model: "z-ai/glm-5.3", maxTokens: 1200 }]);
    expect(t.count("anthropic")).toBe(0);
    expect(t.count("openai")).toBe(0);
    expect(h.logLlmCall.mock.calls[0][0]).toMatchObject({
      routeReason: "test_provider:nvidia",
      attempt: 1,
    });
  });

  it("routes every task and tier to NVIDIA", async () => {
    const t = setup();
    for (const task of Object.keys(MAX_OUTPUT_TOKENS) as LlmGenerateInput["task"][]) {
      for (const tier of ["draft", "standard", "premium"] as const) {
        await t.gateway.generate(input({ task, tier }));
      }
    }
    expect(t.count("anthropic")).toBe(0);
    expect(t.count("openai")).toBe(0);
    expect(t.count("nvidia")).toBe(Object.keys(MAX_OUTPUT_TOKENS).length * 3);
  });

  it("ignores a stored anthropic pin and a per-request provider override", async () => {
    const t = setup({ preference: "anthropic", anthropicModel: "claude-opus-4-8" });

    await t.gateway.generate(input({ preference: "anthropic" }));
    await t.gateway.generate(input({ preference: "openai" }));

    expect(t.count("anthropic")).toBe(0);
    expect(t.count("openai")).toBe(0);
    expect(t.count("nvidia")).toBe(2);
    // Stored preferences are not even read in test mode.
    expect(t.getUserPreference).not.toHaveBeenCalled();
  });

  it("returns a controlled failure when NVIDIA fails — no paid fallback", async () => {
    const t = setup();
    t.nvidia.impl.mockRejectedValue(statusError("nvidia", 503));

    const err = await t.gateway.generate(input()).catch((e) => e);

    expect(err).toBeInstanceOf(AiGatewayError);
    expect(err.category).toBe("provider");
    expect(err.message).not.toMatch(/nvidia/i);
    // One retry on NVIDIA (existing semantics), never Anthropic/OpenAI.
    expect(t.count("nvidia")).toBe(MAX_PRIMARY_ATTEMPTS);
    expect(t.count("anthropic")).toBe(0);
    expect(t.count("openai")).toBe(0);
  });

  it("returns a controlled configuration failure when NVIDIA_API_KEY is missing", async () => {
    const t = setup();
    t.nvidia.impl.mockRejectedValue(
      new LlmProviderError("Missing NVIDIA_API_KEY", { category: "configuration", provider: "nvidia" })
    );

    const err = await t.gateway.generate(input()).catch((e) => e);

    expect(err).toBeInstanceOf(AiGatewayError);
    expect(err.category).toBe("configuration");
    expect(err.message).not.toContain("NVIDIA_API_KEY");
    expect(t.count("nvidia")).toBe(1);
    expect(t.count("anthropic")).toBe(0);
    expect(t.count("openai")).toBe(0);
  });

  it("does not retry an NVIDIA timeout", async () => {
    const t = setup();
    t.nvidia.impl.mockRejectedValue(statusError("nvidia", 408));

    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category: "timeout" });
    expect(t.calls).toHaveLength(1);
  });
});

describe("AI_TEST_PROVIDER misconfiguration", () => {
  it("refuses every call (fails closed) for an unsupported value", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "nvida");
    const t = setup();

    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category: "configuration" });
    expect(t.calls).toHaveLength(0);
  });
});

/* =======================================================
   Normal mode routing
======================================================= */

describe("normal mode routing", () => {
  it("uses the task route when the user has no pin (auto)", async () => {
    const t = setup();
    await t.gateway.generate(input({ task: "ONBOARDING_SUGGESTION", tier: "draft" }));
    expect(t.calls).toEqual([{ provider: "openai", model: "gpt-4o-mini", maxTokens: 1200 }]);
  });

  it("does not let stored model defaults override task routing in auto mode", async () => {
    // Stored defaults (Sonnet / GPT-4o) used to replace every routed model.
    const t = setup({ preference: "auto" });
    await t.gateway.generate(input({ task: "POST_GENERATION", tier: "premium" }));
    expect(t.calls[0]).toMatchObject({ provider: "anthropic", model: "claude-opus-4-8" });
  });

  it("honours an explicit provider pin with the user's allowlisted model", async () => {
    const t = setup({ preference: "anthropic", anthropicModel: "claude-haiku-4-5-20251001" });
    await t.gateway.generate(input({ task: "ONBOARDING_SUGGESTION", tier: "draft" }));
    expect(t.calls).toEqual([
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", maxTokens: 1200 },
    ]);
  });

  it("never forwards a non-allowlisted stored model — uses the provider default", async () => {
    const t = setup({ preference: "openai", openaiTextModel: "o1-pro-super-expensive" });
    await t.gateway.generate(input());
    expect(t.calls).toEqual([{ provider: "openai", model: "gpt-4o", maxTokens: 1200 }]);
  });

  it("never sends another provider's model id to a pinned provider", async () => {
    const t = setup({ preference: "anthropic", anthropicModel: "" });
    await t.gateway.generate(input({ task: "ONBOARDING_SUGGESTION", tier: "draft" }));
    expect(t.calls[0]).toEqual({ provider: "anthropic", model: "claude-sonnet-4-6", maxTokens: 1200 });
  });

  it("keeps WEBSITE_ANALYSIS on NVIDIA with no fallback", async () => {
    const t = setup({ preference: "openai" });
    t.nvidia.impl.mockRejectedValue(statusError("nvidia", 500));
    await expect(t.gateway.generate(input({ task: "WEBSITE_ANALYSIS" }))).rejects.toBeInstanceOf(
      AiGatewayError
    );
    expect(t.count("openai")).toBe(0);
    expect(t.count("anthropic")).toBe(0);
  });
});

/* =======================================================
   Token caps
======================================================= */

describe("output token caps", () => {
  it("clamps an oversized request to the task maximum", async () => {
    const t = setup();
    await t.gateway.generate(input({ task: "POST_REVISION", maxTokens: 100_000 }));
    expect(t.calls[0].maxTokens).toBe(MAX_OUTPUT_TOKENS.POST_REVISION);
  });

  it("keeps a smaller request as-is", async () => {
    const t = setup();
    await t.gateway.generate(input({ task: "CAMPAIGN_PLAN", maxTokens: 500 }));
    expect(t.calls[0].maxTokens).toBe(500);
  });

  it("applies caps in NVIDIA-only mode too", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "nvidia");
    const t = setup();
    await t.gateway.generate(input({ task: "WEBSITE_ANALYSIS", maxTokens: 999_999 }));
    expect(t.calls[0].maxTokens).toBe(MAX_OUTPUT_TOKENS.WEBSITE_ANALYSIS);
  });
});

/* =======================================================
   Bounded retries / fallbacks
======================================================= */

describe("retry and fallback bounds (normal mode)", () => {
  // POST_GENERATION standard → Anthropic Sonnet, fallback OpenAI gpt-4o.

  it("never retries or falls back when the provider key is missing", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(
      new LlmProviderError("Missing ANTHROPIC_API_KEY", { category: "configuration", provider: "anthropic" })
    );

    const err = await t.gateway.generate(input()).catch((e) => e);

    expect(err.category).toBe("configuration");
    expect(err.message).not.toContain("ANTHROPIC_API_KEY");
    expect(t.count("anthropic")).toBe(1);
    expect(t.count("openai")).toBe(0);
  });

  it("treats a legacy 'Missing X_API_KEY' error as configuration, not transient", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(new Error("Missing ANTHROPIC_API_KEY"));
    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category: "configuration" });
    expect(t.calls).toHaveLength(1);
  });

  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [402, "quota"],
    [400, "invalid_request"],
    [404, "invalid_request"],
  ])("does not retry or fall back on HTTP %i (%s)", async (status, category) => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(statusError("anthropic", status));

    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category });
    expect(t.calls).toHaveLength(1);
  });

  it("does not cascade an OpenAI insufficient_quota 429 into Anthropic", async () => {
    const t = setup();
    t.openai.impl.mockRejectedValue(
      statusError("openai", 429, { error: { code: "insufficient_quota" } })
    );

    await expect(
      t.gateway.generate(input({ task: "ONBOARDING_SUGGESTION", tier: "draft" }))
    ).rejects.toMatchObject({ category: "quota" });
    expect(t.calls).toHaveLength(1);
    expect(t.count("anthropic")).toBe(0);
  });

  it("retries a provider rate limit once on the same provider, then stops", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(statusError("anthropic", 429));

    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category: "rate_limit" });
    expect(t.count("anthropic")).toBe(2);
    expect(t.count("openai")).toBe(0);
  });

  it("caps a persistent 5xx at primary retry + one fallback attempt", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(statusError("anthropic", 529));
    t.openai.impl.mockRejectedValue(statusError("openai", 500));

    await expect(t.gateway.generate(input())).rejects.toBeInstanceOf(AiGatewayError);
    expect(t.calls.map((c) => `${c.provider}:${c.model}`)).toEqual([
      "anthropic:claude-sonnet-4-6",
      "anthropic:claude-sonnet-4-6",
      "openai:gpt-4o",
    ]);
    expect(t.calls).toHaveLength(MAX_PRIMARY_ATTEMPTS + MAX_FALLBACK_ATTEMPTS);
  });

  it("falls back once on timeout without retrying the stalled provider", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(
      new LlmProviderError("anthropic request timed out", {
        category: "timeout",
        provider: "anthropic",
        status: 408,
      })
    );

    const result = await t.gateway.generate(input());

    expect(result).toMatchObject({ provider: "openai", model: "gpt-4o", usedFallback: true });
    expect(t.calls.map((c) => c.provider)).toEqual(["anthropic", "openai"]);
    expect(h.logLlmCall.mock.calls[0][0].attempt).toBe(2);
  });

  it("uses a current Anthropic model (not the retired 3.5 Sonnet) as OpenAI's fallback", async () => {
    const t = setup();
    t.openai.impl.mockRejectedValue(statusError("openai", 503));

    await t.gateway.generate(input({ task: "ONBOARDING_SUGGESTION", tier: "draft" }));

    expect(t.calls.map((c) => `${c.provider}:${c.model}`)).toEqual([
      "openai:gpt-4o-mini",
      "openai:gpt-4o-mini",
      "anthropic:claude-sonnet-4-6",
    ]);
  });

  it("recovers on the retry and records the attempt number", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValueOnce(statusError("anthropic", 500));

    const result = await t.gateway.generate(input());

    expect(result).toMatchObject({ provider: "anthropic", usedFallback: false });
    expect(t.calls).toHaveLength(2);
    expect(h.logLlmCall).toHaveBeenCalledTimes(1);
    expect(h.logLlmCall.mock.calls[0][0]).toMatchObject({
      attempt: 2,
      routeReason: "user_pref:auto",
    });
  });

  it("does not retry unknown errors", async () => {
    const t = setup();
    t.anthropic.impl.mockRejectedValue(new Error("something odd"));
    await expect(t.gateway.generate(input())).rejects.toMatchObject({ category: "unknown" });
    expect(t.calls).toHaveLength(1);
  });

  it("logs failed attempts without prompts or provider text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = setup();
    t.anthropic.impl.mockRejectedValue(statusError("anthropic", 401, { error: "sk-ant-secret" }));

    await t.gateway.generate(input({ messages: [{ role: "user", content: "PRIVATE PROMPT" }] })).catch(() => {});

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("authentication");
    expect(logged).toContain("user-1");
    expect(logged).not.toContain("PRIVATE PROMPT");
    expect(logged).not.toContain("sk-ant-secret");
  });
});
