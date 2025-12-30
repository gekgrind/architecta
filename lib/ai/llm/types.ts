export type LlmProvider = "openai" | "anthropic";
export type LlmPreference = "auto" | LlmProvider;

export type TaskType =
  | "ARTICLE_LONGFORM"
  | "BLOG_OUTLINE"
  | "AD_CAMPAIGN"
  | "LANDING_PAGE_COPY"
  | "EMAIL_SEQUENCE"
  | "SOCIAL_CAPTIONS"
  | "SEO_BRIEF";

export type QualityTier = "draft" | "standard" | "premium";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmGenerateInput = {
  workspaceId: string;
  userId?: string;

  task: TaskType;
  tier?: QualityTier;

  // You pass messages, not raw prompt strings, so both providers stay aligned.
  messages: LlmMessage[];

  // Optional guardrails
  maxTokens?: number;
  temperature?: number;

  // Optional user override (Advanced setting in UI)
  preference?: LlmPreference;

  // Optional metadata for logging/debug
  metadata?: Record<string, string | number | boolean | null>;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmResult = {
  provider: LlmProvider;
  model: string;

  text: string;
  usage: LlmUsage;

  // For observability
  requestId?: string;
  latencyMs?: number;

  // if we had to failover
  usedFallback?: boolean;
};

export type LlmError = {
  provider?: LlmProvider;
  code: string;
  message: string;
  retryable?: boolean;
  status?: number;
  raw?: unknown;
};

export type LlmClient = {
  provider: LlmProvider;
  generate: (input: Omit<LlmGenerateInput, "preference"> & { model: string }) => Promise<LlmResult>;
};
