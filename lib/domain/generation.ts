import type { EntityId, IsoDateString } from "./common";
import type { BrandKit } from "./brand";
import type { ContentType } from "./content";

export type ToneHint = "clear" | "bold" | "friendly" | "direct";
export type LengthHint = "shorter" | "balanced" | "longer";
export type CtaHint = "subtle" | "standard" | "strong";
export type StructureHint = "stepwise" | "bulleted" | "narrative";

export type MemoryBias = {
  tone?: ToneHint;
  length?: LengthHint;
  cta?: CtaHint;
  structure?: StructureHint;
};

export type GenerationPlatform = "twitter" | "linkedin" | "email" | "blog" | "ads" | string;

export type GenerationControls = {
  platform: GenerationPlatform;
  idea: string;
  goal?: string;
  context?: string;
};

export type RevisionControls = {
  tone?: "clearer" | "bolder" | "same";
  length?: "shorter" | "same" | "longer";
  ctaStrength?: "subtle" | "same" | "stronger";
};

export type GenerationRequest = {
  workspaceId?: EntityId | null;
  brand?: Partial<BrandKit>;
  gen: GenerationControls;
};

export type GenerationResult = {
  text: string;
  provider?: string;
  model?: string;
  createdAt: IsoDateString;
};

export type StudioRefineRequest = {
  platform: string;
  draft: string;
  revision: RevisionControls;
  brand?: Pick<BrandKit, "brandName"> | null;
};

export type StudioRefineResult = {
  text: string;
  createdAt: IsoDateString;
};

export type GenerationConfig = {
  contentType: ContentType;
  idea: string;
  goal?: string;
  context?: string;
  platform?: GenerationPlatform;
  tone?: "professional" | "casual" | "friendly" | "bold";
  length?: "short" | "medium" | "long";
  temperature?: number;
  maxTokens?: number;
};
