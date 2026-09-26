import type { LlmProvider, TaskType } from "./types";

/**
 * Server-side AI spend policy: test-provider mode, model allowlists and
 * output-token caps. Everything cost-sensitive is decided here — never by the
 * client.
 */

/* =======================================================
   Test-provider mode (AI_TEST_PROVIDER)
======================================================= */

export type AiTestProvider = "nvidia";

/**
 * `AI_TEST_PROVIDER=nvidia` forces every text task onto NVIDIA and disables
 * Anthropic/OpenAI entirely. Any other non-empty value is a misconfiguration
 * and is reported as "invalid" so callers fail closed rather than silently
 * running in paid mode.
 */
export function getAiTestProvider(): AiTestProvider | "invalid" | null {
  const raw = process.env.AI_TEST_PROVIDER?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "nvidia") return "nvidia";
  return "invalid";
}

/** True unless AI_TEST_PROVIDER is unset — paid providers are off in every other state. */
export function isPaidAiDisabled(): boolean {
  return getAiTestProvider() !== null;
}

/* =======================================================
   Model allowlists
======================================================= */

// Only identifiers already used by Architecta's routes or offered in Settings.
export const ALLOWED_ANTHROPIC_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-haiku-4-5-20251001",
] as const;

export const ALLOWED_OPENAI_TEXT_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
] as const;

export const ALLOWED_NVIDIA_MODELS = ["z-ai/glm-5.3"] as const;

export const ALLOWED_OPENAI_IMAGE_MODELS = ["gpt-image-1", "dall-e-3"] as const;

export const ALLOWED_OPENAI_VIDEO_MODELS = ["sora-2", "sora-2-pro"] as const;

const ALLOWED_TEXT_MODELS: Record<LlmProvider, readonly string[]> = {
  anthropic: ALLOWED_ANTHROPIC_MODELS,
  openai: ALLOWED_OPENAI_TEXT_MODELS,
  nvidia: ALLOWED_NVIDIA_MODELS,
};

/** Safe default text model per provider, used when a stored choice is invalid. */
export const DEFAULT_TEXT_MODEL: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  nvidia: "z-ai/glm-5.3",
};

export function isAllowedTextModel(provider: LlmProvider, model: unknown): model is string {
  return typeof model === "string" && ALLOWED_TEXT_MODELS[provider].includes(model);
}

export function isAllowedImageModel(model: unknown): model is string {
  return typeof model === "string" && (ALLOWED_OPENAI_IMAGE_MODELS as readonly string[]).includes(model);
}

export function isAllowedVideoModel(model: unknown): model is string {
  return typeof model === "string" && (ALLOWED_OPENAI_VIDEO_MODELS as readonly string[]).includes(model);
}

/* =======================================================
   Output-token caps
======================================================= */

/** Used when a caller does not ask for a specific output size. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 1200;

/**
 * Hard per-task ceiling on output tokens. Callers may request less, never
 * more. Values match what each feature already requested.
 */
export const MAX_OUTPUT_TOKENS: Record<TaskType, number> = {
  ARTICLE_LONGFORM: 4000,
  BLOG_OUTLINE: 2000,
  AD_CAMPAIGN: 2000,
  LANDING_PAGE_COPY: 3000,
  EMAIL_SEQUENCE: 3000,
  SOCIAL_CAPTIONS: 1200,
  SEO_BRIEF: 2400,
  BRAND_OVERVIEW: 1200,
  BRAND_VOICE: 1200,
  ONBOARDING_SUGGESTION: 1200,
  CONTENT_STRATEGY: 2400,
  POST_GENERATION: 1800,
  POST_REVISION: 1200,
  CAMPAIGN_PLAN: 4000,
  // GLM-5.3 reasoning tokens count toward this cap.
  WEBSITE_ANALYSIS: 4096,
};

export function resolveMaxTokens(task: TaskType, requested?: number): number {
  const cap = MAX_OUTPUT_TOKENS[task] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const wanted =
    typeof requested === "number" && Number.isFinite(requested) && requested > 0
      ? Math.floor(requested)
      : Math.min(DEFAULT_MAX_OUTPUT_TOKENS, cap);
  return Math.max(1, Math.min(wanted, cap));
}
