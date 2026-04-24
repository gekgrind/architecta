export type {
  BrandKit,
  BusinessProfile,
  Campaign,
  ContentItem,
  ContentStatus,
  ContentType,
  CtaHint,
  ExamplePost,
  FounderProfile,
  GenerationConfig,
  GenerationControls,
  LengthHint,
  MemoryBias,
  RevisionControls,
  StructureHint,
  ToneHint,
} from "@/lib/domain";

export type LlmRole = import("@/lib/domain").LlmRole;
export type LlmMessage = import("@/lib/domain").LlmMessage;

export type TaskType =
  | "generate"
  | "refine"
  | "expand"
  | "summarize"
  | "translate";

export type GenerationUIConfig = {
  contentType: import("@/lib/domain").ContentType;
  topic: string;
  keyPoints: string[];
  structure?: import("@/lib/domain").StructureHint;
  tone: number;
  length: "short" | "medium" | "long";
  keywords: string[];
  includeCTA: boolean;
  ctaText?: string;
};

export type PromptBuildOptions = {
  brand: import("@/lib/domain").BrandKit;
  gen: import("@/lib/domain").GenerationControls;
  revision?: import("@/lib/domain").RevisionControls;
  memoryBias?: import("@/lib/domain").MemoryBias;
  strictNoEmojis?: boolean;
  allowHashtags?: boolean;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GeneratedContent = {
  headline: string;
  body: string;
  cta: string;
};
