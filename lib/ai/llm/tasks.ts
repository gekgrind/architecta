import type { ModelChoice, QualityTier, TaskType } from "./types";

type TaskRoute = {
  draft: ModelChoice;
  standard: ModelChoice;
  premium: ModelChoice;
};

// Architecta defaults: Anthropic for deep brand/strategy/longform work, OpenAI for
// fast iteration. Users can pin a provider in settings to override the default.
const SONNET: ModelChoice = { provider: "anthropic", model: "claude-sonnet-4-6" };
const OPUS: ModelChoice = { provider: "anthropic", model: "claude-opus-4-8" };
const HAIKU: ModelChoice = {
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
};
const GPT_4O: ModelChoice = { provider: "openai", model: "gpt-4o" };
const GPT_4O_MINI: ModelChoice = { provider: "openai", model: "gpt-4o-mini" };
const GPT_41_MINI: ModelChoice = { provider: "openai", model: "gpt-4.1-mini" };

export const TASK_ROUTES: Record<TaskType, TaskRoute> = {
  ARTICLE_LONGFORM:      { draft: GPT_41_MINI, standard: SONNET,    premium: OPUS },
  BLOG_OUTLINE:          { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
  AD_CAMPAIGN:           { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
  LANDING_PAGE_COPY:     { draft: GPT_41_MINI, standard: SONNET,    premium: OPUS },
  EMAIL_SEQUENCE:        { draft: GPT_4O_MINI, standard: SONNET,    premium: OPUS },
  SOCIAL_CAPTIONS:       { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
  SEO_BRIEF:             { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
  BRAND_OVERVIEW:        { draft: HAIKU,       standard: SONNET,    premium: OPUS },
  BRAND_VOICE:           { draft: HAIKU,       standard: SONNET,    premium: OPUS },
  ONBOARDING_SUGGESTION: { draft: GPT_4O_MINI, standard: GPT_4O_MINI, premium: GPT_4O },
  CONTENT_STRATEGY:      { draft: GPT_41_MINI, standard: SONNET,    premium: OPUS },
  POST_GENERATION:       { draft: GPT_4O_MINI, standard: SONNET,    premium: OPUS },
  POST_REVISION:         { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
  CAMPAIGN_PLAN:         { draft: GPT_41_MINI, standard: SONNET,    premium: OPUS },
  WEBSITE_ANALYSIS:      { draft: GPT_4O_MINI, standard: GPT_4O,    premium: SONNET },
};

export function normalizeTier(tier?: QualityTier): QualityTier {
  return tier ?? "standard";
}
