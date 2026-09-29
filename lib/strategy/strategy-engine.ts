import type { StrategyRecord } from "@/lib/strategy/strategy-record";

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
  id: string;
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

export type StrategyEngineProfileSource = {
  brandName?: string | null;
  industry?: string | null;
  description?: string | null;
  audience?: string | null;
  typicalCustomers?: string | null;
  offers?: string | null;
};

/**
 * Brief fields Architecta already knows from the saved business profile
 * (GET /api/brand-profile). Goal and current challenge are not captured
 * anywhere yet, so they are left for the founder.
 */
export function strategyEnginePrefillFromProfile(
  profile: StrategyEngineProfileSource | null
): Partial<Pick<StrategyEngineInput, "businessNiche" | "audience" | "offer">> {
  if (!profile) return {};
  const clean = (value: string | null | undefined) => value?.trim() || "";

  const brandName = clean(profile.brandName);
  const industry = clean(profile.industry);
  const businessNiche =
    brandName && industry ? `${brandName} — ${industry}` : brandName || industry || clean(profile.description);
  const audience = clean(profile.audience) || clean(profile.typicalCustomers);
  const offer = clean(profile.offers) || clean(profile.description);

  return {
    ...(businessNiche ? { businessNiche } : {}),
    ...(audience ? { audience } : {}),
    ...(offer ? { offer } : {}),
  };
}

/**
 * Maps the saved strategy returned by POST /api/strategies to the Strategy
 * Engine view. Renders exactly what was persisted — a missing summary or
 * pillars is an error, never replaced with template content.
 */
export function strategyEnginePlanFromRecord(record: StrategyRecord): GeneratedStrategyEnginePlan {
  if (!record.summary?.trim() || !Array.isArray(record.pillars) || record.pillars.length === 0) {
    throw new Error("The strategy came back incomplete, so there is nothing to show. Try generating again.");
  }

  return {
    strategicSummary: record.summary,
    contentPillars: record.pillars.map((pillar) => ({
      id: pillar.id,
      title: pillar.title,
      description: pillar.description,
      moves: pillar.items,
    })),
    growthPriorities: record.growthPriorities ?? [],
    recommendedNextMoves: record.nextActions ?? [],
    thirtyDayFocus: record.thirtyDayFocus ?? [],
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
    data?: { strategy?: StrategyRecord };
    error?: { message?: string };
  } | null;

  if (!res.ok || !json?.ok || !json.data?.strategy) {
    throw new Error(json?.error?.message ?? `Strategy engine request failed (${res.status})`);
  }

  return strategyEnginePlanFromRecord(json.data.strategy);
}
