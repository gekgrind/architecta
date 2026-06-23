export const strategyEnginePlatforms = [
  "LinkedIn",
  "X / Twitter",
  "Instagram",
  "YouTube",
  "Newsletter",
  "Blog / SEO",
] as const;

export type StrategyEnginePlatform = (typeof strategyEnginePlatforms)[number];

export interface StrategyEngineInput {
  businessNiche: string;
  audience: string;
  offer: string;
  primaryGoal: string;
  currentChallenge: string;
  preferredPlatforms: StrategyEnginePlatform[];
}

export interface StrategyPillar {
  title: string;
  description: string;
  moves: string[];
}

export interface GeneratedStrategyEnginePlan {
  strategicSummary: string;
  contentPillars: StrategyPillar[];
  growthPriorities: string[];
  recommendedNextMoves: string[];
  thirtyDayFocus: string[];
}

export const strategyEngineFieldLabels = {
  businessNiche: "Business / niche",
  audience: "Audience",
  offer: "Offer",
  primaryGoal: "Primary goal",
  currentChallenge: "Current challenge",
  preferredPlatforms: "Preferred platforms",
} satisfies Record<keyof StrategyEngineInput, string>;

export function validateStrategyEngineInput(input: StrategyEngineInput) {
  const missingFields = (
    Object.keys(strategyEngineFieldLabels) as Array<keyof StrategyEngineInput>
  ).filter((field) => {
    const value = input[field];

    return Array.isArray(value) ? value.length === 0 : value.trim().length === 0;
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    message:
      missingFields.length === 0
        ? null
        : `Complete ${missingFields
            .map((field) => strategyEngineFieldLabels[field].toLowerCase())
            .join(", ")} before generating.`,
  };
}

type StrategyEnginePillarPayload = {
  title?: unknown;
  description?: unknown;
  items?: unknown;
  moves?: unknown;
};

type GeneratedEnginePayload = {
  summary?: unknown;
  contentPillars?: StrategyEnginePillarPayload[];
  meta?: {
    growthPriorities?: unknown;
    thirtyDayFocus?: unknown;
  };
  nextActions?: unknown;
};

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asEnginePillars(
  value: unknown
): StrategyPillar[] {
  if (!Array.isArray(value)) return [];
  const out: StrategyPillar[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const e = entry as StrategyEnginePillarPayload;
      const title = typeof e.title === "string" ? e.title : null;
      const description = typeof e.description === "string" ? e.description : "";
      const moves = asStrings(e.moves ?? e.items);
      if (title) out.push({ title, description, moves });
    }
  }
  return out;
}

function normalizeStrategyEngine(
  generated: GeneratedEnginePayload,
  input: StrategyEngineInput
): GeneratedStrategyEnginePlan {
  const fallback = generateFallbackStrategyEngine(input);
  const meta = generated.meta ?? {};

  const pillars = asEnginePillars(generated.contentPillars);

  return {
    strategicSummary:
      typeof generated.summary === "string" && generated.summary.trim()
        ? generated.summary
        : fallback.strategicSummary,
    contentPillars: pillars.length ? pillars : fallback.contentPillars,
    growthPriorities: asStrings(meta.growthPriorities).length
      ? asStrings(meta.growthPriorities)
      : fallback.growthPriorities,
    recommendedNextMoves: asStrings(generated.nextActions).length
      ? asStrings(generated.nextActions)
      : fallback.recommendedNextMoves,
    thirtyDayFocus: asStrings(meta.thirtyDayFocus).length
      ? asStrings(meta.thirtyDayFocus)
      : fallback.thirtyDayFocus,
  };
}

export async function generateStrategyEnginePlan(
  input: StrategyEngineInput
): Promise<GeneratedStrategyEnginePlan> {
  const res = await fetch("/api/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "strategy_engine",
      businessNiche: input.businessNiche,
      targetAudience: input.audience,
      offerProduct: input.offer,
      primaryGoal: input.primaryGoal,
      currentChallenge: input.currentChallenge,
      preferredPlatforms: input.preferredPlatforms,
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: { generated?: GeneratedEnginePayload };
    error?: { message?: string };
  } | null;

  if (!res.ok || !json?.ok || !json.data?.generated) {
    throw new Error(json?.error?.message ?? `Strategy engine request failed (${res.status})`);
  }

  return normalizeStrategyEngine(json.data.generated, input);
}

function generateFallbackStrategyEngine(
  input: StrategyEngineInput
): GeneratedStrategyEnginePlan {
  const primaryPlatform = input.preferredPlatforms[0] ?? "LinkedIn";
  const secondaryPlatform = input.preferredPlatforms[1] ?? "Newsletter";

  return {
    strategicSummary: `Architecta should position ${input.businessNiche} as the focused growth system for ${input.audience}. The strategy should connect ${input.offer} to the urgent business outcome of ${input.primaryGoal}, while directly addressing the friction around ${input.currentChallenge}.`,
    contentPillars: [
      {
        title: "Market Problem Clarity",
        description:
          "Make the hidden cost of the current situation obvious before introducing the offer.",
        moves: [
          `Publish ${primaryPlatform} posts that name the strategic cost of ${input.currentChallenge}.`,
          `Use founder-led examples that show why ${input.audience} need a stronger operating system now.`,
          `Anchor each point of view to the business outcome behind ${input.primaryGoal}.`,
        ],
      },
      {
        title: "Proof And Authority",
        description:
          "Turn experience, insight, and repeatable frameworks into trust-building assets.",
        moves: [
          `Create proof assets that make ${input.offer} concrete and outcome-oriented.`,
          "Share decision frameworks that help qualified buyers understand what to fix first.",
          `Repurpose the strongest proof angle into ${secondaryPlatform} for deeper nurturing.`,
        ],
      },
      {
        title: "Conversion Path",
        description:
          "Move the audience from awareness to a practical next step without breaking trust.",
        moves: [
          `Build calls to action around the next logical move after ${input.currentChallenge}.`,
          "Use short diagnostic prompts to identify who is ready for a strategic conversation.",
          `Connect every campaign theme back to ${input.offer} and a clear buyer action.`,
        ],
      },
    ],
    growthPriorities: [
      `Clarify the core promise of ${input.offer} in one conversion-ready sentence.`,
      `Prioritize ${primaryPlatform} as the daily visibility channel and ${secondaryPlatform} as the deeper trust channel.`,
      `Create a repeatable content scorecard tied to ${input.primaryGoal}.`,
      "Separate awareness content, authority content, and decision-stage content before publishing.",
    ],
    recommendedNextMoves: [
      "Choose one campaign theme for the next four weeks and define its conversion action.",
      "Draft three pillar assets before creating platform-specific variations.",
      "Turn the strongest audience objection into a five-part content sequence.",
      "Review signals weekly: qualified replies, saves, booked calls, and content-to-offer clarity.",
    ],
    thirtyDayFocus: [
      "Week 1: sharpen positioning, campaign theme, and proof inventory.",
      `Week 2: publish problem-clarity content on ${primaryPlatform} and collect audience language.`,
      `Week 3: expand the strongest angle into ${secondaryPlatform} and one conversion asset.`,
      `Week 4: optimize the offer bridge and double down on the content angle closest to ${input.primaryGoal}.`,
    ],
  };
}
