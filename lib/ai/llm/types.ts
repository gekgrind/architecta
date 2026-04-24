export type {
  LlmClient,
  LlmGenerateInput,
  LlmMessage,
  LlmPreference,
  LlmProvider,
  LlmResult,
  LlmRoutingResult,
  LlmUsage,
  ModelChoice,
  QualityTier,
} from "@/lib/domain";

export type { LlmTaskType as TaskType } from "@/lib/domain";

export type LlmError = {
  provider?: import("@/lib/domain").LlmProvider;
  code: string;
  message: string;
  retryable?: boolean;
  status?: number;
  raw?: unknown;
};
