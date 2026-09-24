import type { EntityId } from "./common";

export type LlmProvider = "openai" | "anthropic" | "nvidia";
// NVIDIA serves provider-locked tasks only; it is not a user-selectable preference.
export type LlmPreference = "auto" | "openai" | "anthropic";

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmTaskType =
  | "ARTICLE_LONGFORM"
  | "BLOG_OUTLINE"
  | "AD_CAMPAIGN"
  | "LANDING_PAGE_COPY"
  | "EMAIL_SEQUENCE"
  | "SOCIAL_CAPTIONS"
  | "SEO_BRIEF"
  | "BRAND_OVERVIEW"
  | "BRAND_VOICE"
  | "ONBOARDING_SUGGESTION"
  | "CONTENT_STRATEGY"
  | "POST_GENERATION"
  | "POST_REVISION"
  | "CAMPAIGN_PLAN"
  | "WEBSITE_ANALYSIS";

export type QualityTier = "draft" | "standard" | "premium";

export type ModelChoice = {
  provider: LlmProvider;
  model: string;
};

export type LlmGenerateInput = {
  workspaceId: EntityId;
  userId?: EntityId;
  task: LlmTaskType;
  tier?: QualityTier;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  preference?: LlmPreference;
  metadata?: Record<string, string | number | boolean | null>;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmRoutingResult = {
  provider: LlmProvider;
  model: string;
  usedFallback?: boolean;
  routeReason?: string;
};

export type LlmResult = LlmRoutingResult & {
  text: string;
  usage: LlmUsage;
  requestId?: string;
  latencyMs?: number;
};

export type LlmClient = {
  provider: LlmProvider;
  generate: (input: Omit<LlmGenerateInput, "preference"> & { model: string }) => Promise<LlmResult>;
};
