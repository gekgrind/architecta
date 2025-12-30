// lib/types.ts

/* ======================================================
   Tone / Length / Structure Hints
   ====================================================== */

export type ToneHint = "clear" | "bold" | "friendly" | "direct";
export type LengthHint = "shorter" | "balanced" | "longer";
export type CtaHint = "subtle" | "standard" | "strong";
export type StructureHint = "stepwise" | "bulleted" | "narrative";

/* ======================================================
   Memory Bias
   ====================================================== */

export type MemoryBias = {
  tone?: ToneHint;
  length?: LengthHint;
  cta?: CtaHint;
  structure?: StructureHint;
};

/* ======================================================
   Brand / Identity
   ====================================================== */

export type BrandKit = {
  brandName: string;
  audience?: string;
  tone?: string;
  topics?: string[];
  bannedPhrases?: string[];
  examples?: string[];
};

/* ======================================================
   Content Types
   ====================================================== */

export type ContentType =
  | "tweet"
  | "thread"
  | "linkedin"
  | "blog_outline"
  | "blog_post"
  | "article_longform"
  | "email"
  | "ad_copy"
  | "landing_page"
  | "product_description";

/* ======================================================
   LLM / AI CORE TYPES  ✅ (NEW)
   ====================================================== */

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type TaskType =
  | "generate"
  | "refine"
  | "expand"
  | "summarize"
  | "translate";

/* ======================================================
   AI / API Generation Config (INTENT-LEVEL)
   ====================================================== */

export type GenerationConfig = {
  contentType: ContentType;

  /** Prompt intent */
  idea: string;
  goal?: string;
  context?: string;

  /** Platform hint */
  platform?: "twitter" | "linkedin" | "email" | "blog" | "ads";

  /** Output shaping */
  tone?: "professional" | "casual" | "friendly" | "bold";
  length?: "short" | "medium" | "long";

  /** Model behavior */
  temperature?: number;
  maxTokens?: number;
};

/* ======================================================
   UI / Studio Generation Config (USED BY CONTROLS PANEL)
   ====================================================== */

export type GenerationUIConfig = {
  /* Core */
  contentType: ContentType;
  topic: string;

  /* Structure */
  keyPoints: string[];
  structure?: StructureHint;

  /* Tone & length (UI-driven) */
  tone: number; // 0–100 slider
  length: "short" | "medium" | "long";

  /* SEO */
  keywords: string[];

  /* CTA */
  includeCTA: boolean;
  ctaText?: string;
};

/* ======================================================
   Studio Controls (existing)
   ====================================================== */

export type GenerationControls = {
  platform: string;
  idea: string;
  goal?: string;
  context?: string;
};

export type RevisionControls = {
  tone?: "clearer" | "bolder" | "same";
  length?: "shorter" | "same" | "longer";
  ctaStrength?: "subtle" | "same" | "stronger";
};

/* ======================================================
   Prompt Builder
   ====================================================== */

export type PromptBuildOptions = {
  brand: BrandKit;
  gen: GenerationControls;
  revision?: RevisionControls;
  memoryBias?: MemoryBias;
  strictNoEmojis?: boolean;
  allowHashtags?: boolean;
};

/* ======================================================
   Chat / Output
   ====================================================== */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GeneratedContent = {
  headline: string;
  body: string;
  cta: string;
};

/* ======================================================
   Content Library Item (UI + Data Ready)
   ====================================================== */

export type ContentItem = {
  id: string;

  /** Core identity */
  contentType: ContentType;
  status: "draft" | "published" | "scheduled" | "archived";

  /** Display content */
  title: string;
  content: string;
  cta?: string;

  /** Metadata */
  createdAt: string;
  updatedAt?: string;

  /** Optional analytics */
  performanceData?: {
    engagements: number;
    clicks?: number;
    impressions?: number;
  };

  /** Organization */
  campaign?: string;
  brandName?: string;
};

/* ======================================================
   Example / Demo Content
   ====================================================== */

export type ExamplePost = {
  id: string;
  title: string;
  content?: string;
  created_at?: string;
};

