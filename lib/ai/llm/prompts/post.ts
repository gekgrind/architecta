import "server-only";

import { asStringArray, extractJson } from "../json";

export type PostPromptBrand = {
  brandName?: string | null;
  industry?: string | null;
  audience?: string | null;
  voiceDescription?: string | null;
  bannedPhrases?: string[] | null;
  requiredElements?: string[] | null;
};

export type PostPromptInput = {
  platform: string;
  topic: string;
  keyPoints: string[];
  tone?: string;
  length: "short" | "medium" | "long";
  includeCta: boolean;
  ctaText?: string;
  keywords: string[];
  generateImagePrompt: boolean;
  generateVideoPrompt: boolean;
  brand?: PostPromptBrand | null;
  founderStyle?: string | null;
  strategySummary?: string | null;
};

export type PostPromptOutput = {
  title: string;
  hook: string;
  caption: string;
  body: string;
  hashtags: string[];
  cta: string;
  imagePrompt: string;
  videoPrompt: string;
};

function brandBlock(brand?: PostPromptBrand | null): string {
  if (!brand) return "No brand profile yet.";
  const lines = [
    brand.brandName ? `Brand: ${brand.brandName}` : null,
    brand.industry ? `Industry: ${brand.industry}` : null,
    brand.audience ? `Audience: ${brand.audience}` : null,
    brand.voiceDescription ? `Voice: ${brand.voiceDescription}` : null,
    brand.bannedPhrases?.length
      ? `Banned phrases: ${brand.bannedPhrases.join(", ")}`
      : null,
    brand.requiredElements?.length
      ? `Required elements: ${brand.requiredElements.join(", ")}`
      : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "No brand profile yet.";
}

export function buildPostUserPrompt(input: PostPromptInput): string {
  const keyPoints = input.keyPoints.filter(Boolean);
  const keywords = input.keywords.filter(Boolean);

  return `
Write one piece of social content. Return ONLY JSON that conforms exactly to
the schema below — no prose, no explanation, no fenced code block.

# Request
- Platform: ${input.platform}
- Topic: ${input.topic}
- Tone: ${input.tone ?? "neutral, matching brand voice"}
- Length: ${input.length}
- Key points:
${keyPoints.length ? keyPoints.map((p) => `  - ${p}`).join("\n") : "  - (none)"}
- Keywords: ${keywords.length ? keywords.join(", ") : "(none)"}
- Include CTA: ${input.includeCta ? "yes" : "no"}
- CTA hint: ${input.ctaText ?? "(none)"}

# Brand
${brandBlock(input.brand)}

# Founder style profile
${input.founderStyle ?? "Not established yet."}

# Active strategy summary
${input.strategySummary ?? "No active strategy."}

# JSON schema
{
  "title":       "string (≤ 80 chars, descriptive label for the library)",
  "hook":        "string (1-3 lines, strong opener)",
  "caption":     "string (the published caption / copy)",
  "body":        "string (long-form expansion when the platform supports it; otherwise repeat caption)",
  "hashtags":    ["string"],
  "cta":         "string (single CTA line; empty string if no CTA)",
  "imagePrompt": ${input.generateImagePrompt ? '"string"' : '""'},
  "videoPrompt": ${input.generateVideoPrompt ? '"string"' : '""'}
}

Rules:
- Output platform-native formatting (line breaks, hashtag conventions, etc.).
- Respect banned phrases. Apply required elements.
- Match the founder voice when supplied.
${input.includeCta ? "" : "- Omit any explicit CTA in the body and leave \"cta\" as an empty string.\n"}
`.trim();
}

export function parsePostResponse(text: string): PostPromptOutput {
  const raw = extractJson<Record<string, unknown>>(text);

  const str = (key: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : "";

  return {
    title: str("title"),
    hook: str("hook"),
    caption: str("caption"),
    body: str("body") || str("caption"),
    hashtags: asStringArray(raw.hashtags).map((h) =>
      h.startsWith("#") ? h.slice(1) : h
    ),
    cta: str("cta"),
    imagePrompt: str("imagePrompt"),
    videoPrompt: str("videoPrompt"),
  };
}

export type PostRevisionInput = {
  platform: string;
  draft: string;
  tone: "same" | "clearer" | "bolder" | "warmer" | "tighter";
  length: "same" | "shorter" | "longer";
  ctaStrength: "same" | "stronger" | "subtle";
  customInstructions?: string;
  brand?: PostPromptBrand | null;
  founderStyle?: string | null;
};

export function buildPostRevisionPrompt(input: PostRevisionInput): string {
  const instructions: string[] = [];
  if (input.tone === "clearer") instructions.push("Make the tone clearer and more direct.");
  if (input.tone === "bolder") instructions.push("Make the tone bolder and more confident.");
  if (input.tone === "warmer") instructions.push("Make the tone warmer and more human.");
  if (input.tone === "tighter") instructions.push("Tighten the language. Cut filler.");
  if (input.length === "shorter") instructions.push("Make the content more concise.");
  if (input.length === "longer") instructions.push("Expand the content meaningfully.");
  if (input.ctaStrength === "stronger") instructions.push("Strengthen the call to action.");
  if (input.ctaStrength === "subtle") instructions.push("Soften the call to action.");
  if (input.customInstructions) instructions.push(input.customInstructions);

  return `
Revise the draft below. Preserve the original intent. Do not introduce new
ideas. Apply only the requested refinements. Return the revised text only —
no preamble.

# Platform
${input.platform}

# Brand
${brandBlock(input.brand)}

# Founder style profile
${input.founderStyle ?? "Not established yet."}

# Original draft
"""
${input.draft}
"""

# Refinement instructions
${instructions.length ? instructions.map((i) => `- ${i}`).join("\n") : "- (no changes requested)"}
`.trim();
}
