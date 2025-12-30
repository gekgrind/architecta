import type { LlmProvider, QualityTier, TaskType } from "./types";

export type ModelChoice = {
  provider: LlmProvider;
  model: string;
};

type TaskRoute = {
  draft: ModelChoice;
  standard: ModelChoice;
  premium: ModelChoice;
};

// Keep this small and tweak over time.
// The point: Architecta chooses by intent, users can override in “Advanced”.
export const TASK_ROUTES: Record<TaskType, TaskRoute> = {
  ARTICLE_LONGFORM: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    premium: { provider: "openai",    model: "gpt-4o" },
  },
  BLOG_OUTLINE: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "openai",    model: "gpt-4o" },
    premium: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  },
  AD_CAMPAIGN: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "openai",    model: "gpt-4o" },
    premium: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  },
  LANDING_PAGE_COPY: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    premium: { provider: "openai",    model: "gpt-4o" },
  },
  EMAIL_SEQUENCE: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    premium: { provider: "openai",    model: "gpt-4o" },
  },
  SOCIAL_CAPTIONS: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "openai",    model: "gpt-4o-mini" },
    premium: { provider: "openai",    model: "gpt-4o" },
  },
  SEO_BRIEF: {
    draft:   { provider: "openai",    model: "gpt-4o-mini" },
    standard:{ provider: "openai",    model: "gpt-4o" },
    premium: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  },
};

export function normalizeTier(tier?: QualityTier): QualityTier {
  return tier ?? "standard";
}
