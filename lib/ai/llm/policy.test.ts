import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => {
    const builder = {
      from: () => builder,
      select: () => builder,
      eq: () => builder,
      maybeSingle: h.maybeSingle,
    };
    return builder;
  }),
}));

import {
  getAiTestProvider,
  isAllowedTextModel,
  isPaidAiDisabled,
  MAX_OUTPUT_TOKENS,
  resolveMaxTokens,
} from "./policy";
import { DEFAULT_USER_AI_PREFERENCE, getUserAiPreference } from "./preferences";
import { buildRoutePlan } from "./router";
import { NVIDIA_GLM, TASK_ROUTES } from "./tasks";
import { userSettingsPatchSchema } from "@/lib/validation/settings";
import { imageGenerateInputSchema, videoGenerateInputSchema } from "@/lib/validation/asset";

beforeEach(() => {
  vi.stubEnv("AI_TEST_PROVIDER", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AI_TEST_PROVIDER", () => {
  it("is off when unset", () => {
    expect(getAiTestProvider()).toBeNull();
    expect(isPaidAiDisabled()).toBe(false);
  });

  it("recognises nvidia (case/whitespace-insensitive)", () => {
    vi.stubEnv("AI_TEST_PROVIDER", "  NVIDIA ");
    expect(getAiTestProvider()).toBe("nvidia");
    expect(isPaidAiDisabled()).toBe(true);
  });

  it("treats any other value as invalid and keeps paid AI off", () => {
    vi.stubEnv("AI_TEST_PROVIDER", "openai");
    expect(getAiTestProvider()).toBe("invalid");
    expect(isPaidAiDisabled()).toBe(true);
  });
});

describe("model allowlist", () => {
  it("accepts every model the task routes use", () => {
    for (const route of Object.values(TASK_ROUTES)) {
      for (const choice of Object.values(route)) {
        expect(isAllowedTextModel(choice.provider, choice.model)).toBe(true);
      }
    }
  });

  it("confirms the NVIDIA model id already used by the implementation", () => {
    expect(NVIDIA_GLM).toEqual({ provider: "nvidia", model: "z-ai/glm-5.3" });
    expect(isAllowedTextModel("nvidia", "z-ai/glm-5.3")).toBe(true);
  });

  it("rejects arbitrary, retired, or cross-provider ids", () => {
    expect(isAllowedTextModel("anthropic", "claude-3-5-sonnet-latest")).toBe(false);
    expect(isAllowedTextModel("anthropic", "gpt-4o")).toBe(false);
    expect(isAllowedTextModel("openai", "o1-pro")).toBe(false);
    expect(isAllowedTextModel("nvidia", "meta/llama-405b")).toBe(false);
    expect(isAllowedTextModel("openai", undefined)).toBe(false);
  });

  it("settings validation rejects non-allowlisted model ids", () => {
    expect(userSettingsPatchSchema.safeParse({ anthropicModel: "claude-opus-4-8" }).success).toBe(true);
    expect(userSettingsPatchSchema.safeParse({ anthropicModel: "claude-9-mega" }).success).toBe(false);
    expect(userSettingsPatchSchema.safeParse({ openaiTextModel: "o1-pro" }).success).toBe(false);
    expect(userSettingsPatchSchema.safeParse({ openaiImageModel: "x" }).success).toBe(false);
    expect(userSettingsPatchSchema.safeParse({ openaiVideoModel: null }).success).toBe(true);
    expect(userSettingsPatchSchema.safeParse({ openaiVideoModel: "sora-9" }).success).toBe(false);
  });

  it("asset validation rejects non-allowlisted image/video models", () => {
    expect(imageGenerateInputSchema.safeParse({ prompt: "p", model: "dall-e-9" }).success).toBe(false);
    expect(imageGenerateInputSchema.parse({ prompt: "p" }).model).toBe("gpt-image-1");
    expect(videoGenerateInputSchema.safeParse({ prompt: "p", model: "sora-9" }).success).toBe(false);
    expect(videoGenerateInputSchema.parse({ prompt: "p" }).model).toBe("sora-2");
  });
});

describe("resolveMaxTokens", () => {
  it("clamps oversized requests to the task cap", () => {
    expect(resolveMaxTokens("POST_GENERATION", 50_000)).toBe(MAX_OUTPUT_TOKENS.POST_GENERATION);
  });

  it("keeps smaller requests", () => {
    expect(resolveMaxTokens("CAMPAIGN_PLAN", 800)).toBe(800);
  });

  it("uses the 1200 default (or the cap if lower) when not requested or invalid", () => {
    expect(resolveMaxTokens("CAMPAIGN_PLAN")).toBe(1200);
    expect(resolveMaxTokens("CAMPAIGN_PLAN", -5)).toBe(1200);
    expect(resolveMaxTokens("CAMPAIGN_PLAN", Number.NaN)).toBe(1200);
  });

  it("keeps existing call-site values within their caps", () => {
    // Values the routes already request must not be reduced by the caps.
    expect(resolveMaxTokens("POST_GENERATION", 1800)).toBe(1800);
    expect(resolveMaxTokens("POST_REVISION", 1200)).toBe(1200);
    expect(resolveMaxTokens("CONTENT_STRATEGY", 2400)).toBe(2400);
    expect(resolveMaxTokens("CAMPAIGN_PLAN", 4000)).toBe(4000);
    expect(resolveMaxTokens("WEBSITE_ANALYSIS", 4096)).toBe(4096);
  });
});

describe("default provider preference", () => {
  it("is auto when the user has no settings row", async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    const pref = await getUserAiPreference("user-1");
    expect(pref.textProvider).toBe("auto");
    expect(DEFAULT_USER_AI_PREFERENCE.textProvider).toBe("auto");
  });

  it("an absent preference routes by task, not to paid Claude", () => {
    const plan = buildRoutePlan({ task: "ONBOARDING_SUGGESTION", tier: "draft" });
    expect(plan.primary).toEqual({ provider: "openai", model: "gpt-4o-mini" });
  });

  it("keeps an explicit stored pin", async () => {
    h.maybeSingle.mockResolvedValue({
      data: { text_provider: "anthropic", anthropic_model: "claude-opus-4-8" },
      error: null,
    });
    const pref = await getUserAiPreference("user-1");
    expect(pref.textProvider).toBe("anthropic");
    expect(pref.anthropicModel).toBe("claude-opus-4-8");
  });

  it("replaces non-allowlisted stored model ids with safe defaults", async () => {
    h.maybeSingle.mockResolvedValue({
      data: {
        text_provider: "openai",
        anthropic_model: "claude-3-5-sonnet-latest",
        openai_text_model: "o1-pro",
        openai_image_model: "nope",
        openai_video_model: "sora-9",
      },
      error: null,
    });
    const pref = await getUserAiPreference("user-1");
    expect(pref).toEqual({
      textProvider: "openai",
      anthropicModel: "claude-sonnet-4-6",
      openaiTextModel: "gpt-4o",
      openaiImageModel: "gpt-image-1",
      openaiVideoModel: null,
    });
  });
});

describe("router bounds", () => {
  it("has at most one fallback step for every task, tier and preference", () => {
    for (const task of Object.keys(TASK_ROUTES) as (keyof typeof TASK_ROUTES)[]) {
      for (const tier of ["draft", "standard", "premium"] as const) {
        for (const preference of ["auto", "openai", "anthropic"] as const) {
          const plan = buildRoutePlan({ task, tier, workspacePreference: preference });
          expect(plan.fallbacks.length).toBeLessThanOrEqual(1);
          for (const step of [plan.primary, ...plan.fallbacks]) {
            expect(isAllowedTextModel(step.provider, step.model)).toBe(true);
          }
        }
      }
    }
  });

  it("returns NVIDIA with no fallback for every task in NVIDIA-only mode", () => {
    for (const task of Object.keys(TASK_ROUTES) as (keyof typeof TASK_ROUTES)[]) {
      const plan = buildRoutePlan({ task, tier: "premium", workspacePreference: "anthropic", nvidiaOnly: true });
      expect(plan).toEqual({ primary: NVIDIA_GLM, fallbacks: [] });
    }
  });
});
