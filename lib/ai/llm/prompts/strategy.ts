import "server-only";

import { asSectionArray, asStringArray, extractJson } from "../json";

export type StrategyKind =
  | "content_strategy"
  | "content_architect"
  | "strategy_engine";

export type StrategyPromptInput = {
  kind: StrategyKind;
  businessNiche: string;
  targetAudience: string;
  contentGoals?: string;
  offerProduct?: string;
  preferredPlatforms: string[];
  toneBrandStyle?: string;
  currentChallenge?: string;
  primaryGoal?: string;
};

export type StrategyPromptOutput = {
  summary: string;
  contentPillars: Array<{ title: string; items: string[]; description?: string }>;
  audienceAngles: string[];
  contentThemes: string[];
  postingCadence: string[];
  quickWins: string[];
  nextActions: string[];
  weeklyThemes: Array<{ title: string; items: string[] }>;
  postIdeas: Array<{ title: string; items: string[] }>;
  contentFormats: string[];
  repurposingIdeas: string[];
  growthPriorities: string[];
  thirtyDayFocus: string[];
};

export function buildStrategyUserPrompt(input: StrategyPromptInput): string {
  const platforms = input.preferredPlatforms.join(", ");

  return `
Build a structured content strategy for the following founder. Return ONLY JSON
that conforms exactly to the schema below — no prose, no explanation.

# Business
- Niche: ${input.businessNiche}
- Target audience: ${input.targetAudience}
- Offer / product: ${input.offerProduct ?? "Not specified"}
- Tone / brand style: ${input.toneBrandStyle ?? "Not specified"}
- Preferred platforms: ${platforms}
- Primary goal: ${input.primaryGoal ?? input.contentGoals ?? "Not specified"}
- Current challenge: ${input.currentChallenge ?? "Not specified"}
- Content goals: ${input.contentGoals ?? "Not specified"}

# JSON schema (all fields required, arrays may be empty if irrelevant)
{
  "summary": "string, 2-3 sentence strategic summary",
  "contentPillars": [
    { "title": "string", "description": "string", "items": ["string"] }
  ],
  "audienceAngles": ["string"],
  "contentThemes": ["string"],
  "postingCadence": ["string"],
  "quickWins": ["string"],
  "nextActions": ["string"],
  "weeklyThemes": [{ "title": "string", "items": ["string"] }],
  "postIdeas": [{ "title": "string", "items": ["string"] }],
  "contentFormats": ["string"],
  "repurposingIdeas": ["string"],
  "growthPriorities": ["string"],
  "thirtyDayFocus": ["string"]
}

Aim for 3-5 entries per array. Be concrete, platform-aware, and founder-friendly.
`.trim();
}

export function parseStrategyResponse(text: string): StrategyPromptOutput {
  const raw = extractJson<Record<string, unknown>>(text);

  const pillars = Array.isArray(raw.contentPillars) ? raw.contentPillars : [];
  const contentPillars = pillars
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .map((entry) => ({
      title: typeof entry.title === "string" ? entry.title : "Untitled pillar",
      description:
        typeof entry.description === "string" ? entry.description : undefined,
      items: asStringArray(entry.items),
    }));

  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    contentPillars,
    audienceAngles: asStringArray(raw.audienceAngles),
    contentThemes: asStringArray(raw.contentThemes),
    postingCadence: asStringArray(raw.postingCadence),
    quickWins: asStringArray(raw.quickWins),
    nextActions: asStringArray(raw.nextActions),
    weeklyThemes: asSectionArray(raw.weeklyThemes),
    postIdeas: asSectionArray(raw.postIdeas),
    contentFormats: asStringArray(raw.contentFormats),
    repurposingIdeas: asStringArray(raw.repurposingIdeas),
    growthPriorities: asStringArray(raw.growthPriorities),
    thirtyDayFocus: asStringArray(raw.thirtyDayFocus),
  };
}
