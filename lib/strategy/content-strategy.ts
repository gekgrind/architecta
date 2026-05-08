export const contentStrategyPlatforms = [
  "LinkedIn",
  "X / Twitter",
  "Instagram",
  "YouTube",
  "Newsletter",
  "Blog / SEO",
] as const;

export type ContentStrategyPlatform = (typeof contentStrategyPlatforms)[number];

export interface ContentStrategyInput {
  businessNiche: string;
  targetAudience: string;
  contentGoals: string;
  offerProduct: string;
  preferredPlatforms: ContentStrategyPlatform[];
  toneBrandStyle: string;
}

export interface StrategySection {
  title: string;
  items: string[];
}

export interface GeneratedContentStrategy {
  summary: string;
  contentPillars: StrategySection[];
  audienceAngles: string[];
  contentThemes: string[];
  postingCadence: string[];
  quickWins: string[];
  nextActions: string[];
}

export const contentStrategyFieldLabels = {
  businessNiche: "Business / niche",
  targetAudience: "Target audience",
  contentGoals: "Content goals",
  offerProduct: "Offer / product",
  preferredPlatforms: "Preferred platforms",
  toneBrandStyle: "Tone / brand style",
} satisfies Record<keyof ContentStrategyInput, string>;

const fallbackPlatforms: ContentStrategyPlatform[] = ["LinkedIn", "Newsletter"];

function splitContentGoals(goals: string): string[] {
  const parsedGoals = goals
    .split(/[,.\n]/)
    .map((goal) => goal.trim())
    .filter(Boolean);

  return parsedGoals.length > 0
    ? parsedGoals.slice(0, 3)
    : ["build trust", "create demand", "convert qualified prospects"];
}

export function validateContentStrategyInput(input: ContentStrategyInput) {
  const missingFields = (
    Object.keys(contentStrategyFieldLabels) as Array<keyof ContentStrategyInput>
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
            .map((field) => contentStrategyFieldLabels[field].toLowerCase())
            .join(", ")} before generating.`,
  };
}

export async function generateMockContentStrategy(
  input: ContentStrategyInput
): Promise<GeneratedContentStrategy> {
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const platforms =
    input.preferredPlatforms.length > 0
      ? input.preferredPlatforms
      : fallbackPlatforms;
  const goals = splitContentGoals(input.contentGoals);
  const primaryPlatform = platforms[0];
  const secondaryPlatform = platforms[1] ?? "Newsletter";

  return {
    summary: `Position ${input.businessNiche} as the trusted growth system for ${input.targetAudience}, using ${input.toneBrandStyle.toLowerCase()} content that connects the problem, proof, and path to ${input.offerProduct}.`,
    contentPillars: [
      {
        title: "Strategic Problem Clarity",
        items: [
          `Name the hidden costs ${input.targetAudience} already feel but may not have organized yet.`,
          `Show why the old way breaks down for ${input.businessNiche} and what a stronger operating model looks like.`,
          `Tie each post back to the business pressure behind ${goals[0]}.`,
        ],
      },
      {
        title: "Founder-Led Proof",
        items: [
          "Turn client patterns, lessons learned, and decision frameworks into reusable authority assets.",
          `Use before-and-after examples that make ${input.offerProduct} feel concrete instead of abstract.`,
          `Publish a recurring point of view on ${primaryPlatform} that compounds recognition.`,
        ],
      },
      {
        title: "Execution Path",
        items: [
          `Break the route from awareness to ${input.offerProduct} into simple, repeatable steps.`,
          `Create tactical assets for ${secondaryPlatform} that help qualified buyers take the next action.`,
          "End each week with one clear conversion bridge: reply, book, download, or audit.",
        ],
      },
    ],
    audienceAngles: [
      `The moment ${input.targetAudience} realize growth is being limited by an unstructured content system.`,
      `What ${input.targetAudience} have tried already, why it felt scattered, and what should replace it.`,
      `The practical tradeoffs behind choosing ${input.offerProduct} now versus waiting another quarter.`,
      `How a premium ${input.businessNiche} system protects focus while increasing visible market authority.`,
    ],
    contentThemes: [
      `${input.businessNiche} teardown: what is working, what is leaking trust, and what to fix first.`,
      `Founder POV: a contrarian belief about ${goals[0]} backed by a concrete example.`,
      `Decision guide: how ${input.targetAudience} should evaluate ${input.offerProduct}.`,
      `Behind the system: the repeatable workflow that turns strategy into publishable assets.`,
      `Proof asset: one result, lesson, or objection reframed into a conversion-aware story.`,
    ],
    postingCadence: [
      `${primaryPlatform}: 3 focused posts per week across problem clarity, proof, and next-step education.`,
      `${secondaryPlatform}: 1 deeper weekly asset that expands the strongest post into a strategic narrative.`,
      "Monthly: 1 flagship guide or teardown that can feed clips, carousels, emails, and sales follow-up.",
      "Weekly review: score each asset by clarity, audience fit, offer relevance, and next-action strength.",
    ],
    quickWins: [
      `Turn the clearest ${input.offerProduct} objection into a 5-post sequence this week.`,
      "Create one reusable CTA line for each buying stage: curious, problem-aware, and ready to act.",
      `Pin a short positioning post on ${primaryPlatform} that states who you help, what changes, and why now.`,
      "Repurpose the strongest weekly idea into one email and one sales follow-up note.",
    ],
    nextActions: [
      "Choose the first 30-day campaign theme and define the conversion action for that theme.",
      "Draft three pillar posts before creating any platform-specific variations.",
      "Build a lightweight content scorecard so each asset has a strategic job before publishing.",
      "Review performance after two weeks and double down on the angle that creates the most qualified replies.",
    ],
  };
}
