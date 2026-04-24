// lib/ai/prompts/types.ts

/**
 * ============================
 * Core Content Types
 * ============================
 * These define what kind of content Architecta can generate.
 * Keep these in sync with UI conditionals and generation logic.
 */

export type Platform =
  | "x_post"
  | "x_thread"
  | "linkedin_post"
  | "marketing_email"
  | "blog_outline"
  | "ad_angles";

/**
 * ============================
 * Generation Status
 * ============================
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * ============================
 * Brand / Workspace Types
 * ============================
 */

export interface BrandKit {
  brandName: string;
  audience?: string;
  tone?: string;
  topics?: string[];
  bannedPhrases?: string[];
  examples?: string[];
}

/**
 * ============================
 * Content Record
 * ============================
 * Used for saved drafts, previews, and libraries
 */

export type RevisionControls = {
  tone?: "clearer" | "bolder" | "same";
  length?: "shorter" | "same" | "longer";
  ctaStrength?: "subtle" | "same" | "stronger";
  complexity?: "simpler" | "same" | "deeper";
};

export type GenerationControls = {
  platform: Platform;
  idea: string;
  goal?: string;
  context?: string;
  email?: {
    fromName?: string;
    fromBrand?: string;
    primaryCta?: string;
  };
};

export type PromptBuildOptions = {
  brand: BrandKit;
  gen: GenerationControls;
  revision?: RevisionControls;
  strictNoEmojis?: boolean;
  allowHashtags?: boolean;
};

export type BuiltPrompt = {
  modelHint?: string;
  messages: ChatMessage[];
  metadata?: Record<string, string | number | boolean | null>;
};
