import "server-only";

import { asStringArray, extractJson } from "../json";
import type { PostPromptBrand } from "./post";

export type CampaignPromptInput = {
  name: string;
  theme: string;
  goal: string;
  launchDate?: string | null;
  platforms: string[];
  postsPerPlatform: number;
  includeEmail: boolean;
  includeBlog: boolean;
  brand?: PostPromptBrand | null;
  founderStyle?: string | null;
  strategySummary?: string | null;
};

export type CampaignPromptPost = {
  platform: string;
  title: string;
  hook: string;
  caption: string;
  body: string;
  hashtags: string[];
  cta: string;
  imagePrompt: string;
  videoPrompt: string;
};

export type CampaignPromptOutput = {
  summary: string;
  launchSequence: string[];
  promotionalAngles: string[];
  repurposingIdeas: string[];
  posts: CampaignPromptPost[];
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

export function buildCampaignUserPrompt(input: CampaignPromptInput): string {
  const totalPosts = input.platforms.length * input.postsPerPlatform;
  const extras: string[] = [];
  if (input.includeEmail) extras.push("one email broadcast");
  if (input.includeBlog) extras.push("one supporting blog outline");

  return `
Design a launch campaign and write every post for it. Return ONLY JSON that
conforms exactly to the schema below — no prose, no fenced block.

# Campaign brief
- Name: ${input.name}
- Theme: ${input.theme}
- Goal: ${input.goal}
- Launch date: ${input.launchDate ?? "TBD"}
- Platforms: ${input.platforms.join(", ")}
- Posts per platform: ${input.postsPerPlatform} (total ${totalPosts} platform posts)
${extras.length ? `- Also include: ${extras.join("; ")}` : ""}

# Brand
${brandBlock(input.brand)}

# Founder style profile
${input.founderStyle ?? "Not established yet."}

# Active strategy summary
${input.strategySummary ?? "No active strategy."}

# JSON schema
{
  "summary": "string (2-3 sentence campaign narrative)",
  "launchSequence": ["string"],
  "promotionalAngles": ["string"],
  "repurposingIdeas": ["string"],
  "posts": [
    {
      "platform": "string (matches one of the requested platforms${
        input.includeEmail ? ", or 'email'" : ""
      }${input.includeBlog ? ", or 'blog'" : ""})",
      "title": "string (≤ 80 chars)",
      "hook": "string",
      "caption": "string (the published copy)",
      "body": "string (long-form expansion when relevant; else repeat caption)",
      "hashtags": ["string"],
      "cta": "string (empty if no CTA)",
      "imagePrompt": "string (always include a vivid image prompt)",
      "videoPrompt": "string (empty unless the post is video-first)"
    }
  ]
}

Rules:
- Output exactly ${input.postsPerPlatform} posts per platform${
    input.includeEmail ? " plus one 'email' post" : ""
  }${input.includeBlog ? " plus one 'blog' post" : ""}.
- Vary the angle across posts (problem, proof, story, offer, recap).
- Match each platform's native formatting and length conventions.
- Stay within brand voice and avoid banned phrases.
`.trim();
}

export function parseCampaignResponse(text: string): CampaignPromptOutput {
  const raw = extractJson<Record<string, unknown>>(text);

  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const posts = Array.isArray(raw.posts) ? raw.posts : [];

  const parsedPosts: CampaignPromptPost[] = posts
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .map((entry) => {
      const str = (key: string) =>
        typeof entry[key] === "string" ? (entry[key] as string) : "";

      return {
        platform: str("platform") || "linkedin",
        title: str("title"),
        hook: str("hook"),
        caption: str("caption"),
        body: str("body") || str("caption"),
        hashtags: asStringArray(entry.hashtags).map((h) =>
          h.startsWith("#") ? h.slice(1) : h
        ),
        cta: str("cta"),
        imagePrompt: str("imagePrompt"),
        videoPrompt: str("videoPrompt"),
      };
    });

  return {
    summary,
    launchSequence: asStringArray(raw.launchSequence),
    promotionalAngles: asStringArray(raw.promotionalAngles),
    repurposingIdeas: asStringArray(raw.repurposingIdeas),
    posts: parsedPosts,
  };
}
