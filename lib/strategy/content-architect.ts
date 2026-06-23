export const contentArchitectPlatforms = [
  "LinkedIn",
  "X / Twitter",
  "Instagram",
  "YouTube",
  "Newsletter",
  "Blog / SEO",
] as const;

export type ContentArchitectPlatform =
  (typeof contentArchitectPlatforms)[number];

export interface ContentArchitectInput {
  strategySummary: string;
  audience: string;
  contentGoal: string;
  platform: ContentArchitectPlatform;
  tone: string;
  offerProduct: string;
}

export interface ContentArchitectSection {
  title: string;
  items: string[];
}

export interface GeneratedContentArchitectPlan {
  summary: string;
  contentPillars: ContentArchitectSection[];
  weeklyThemes: ContentArchitectSection[];
  postIdeas: ContentArchitectSection[];
  contentFormats: string[];
  repurposingIdeas: string[];
}

export const contentArchitectFieldLabels = {
  strategySummary: "Strategy summary",
  audience: "Audience",
  contentGoal: "Content goal",
  platform: "Platform",
  tone: "Tone",
  offerProduct: "Offer / product",
} satisfies Record<keyof ContentArchitectInput, string>;

function splitStrategySignals(strategySummary: string): string[] {
  const signals = strategySummary
    .split(/[,.;\n]/)
    .map((signal) => signal.trim())
    .filter(Boolean);

  return signals.length > 0
    ? signals.slice(0, 4)
    : [
        "clarify the market problem",
        "show the strategic method",
        "connect proof to the offer",
      ];
}

function normalizeGoal(contentGoal: string) {
  return contentGoal.trim().toLowerCase();
}

export function validateContentArchitectInput(input: ContentArchitectInput) {
  const missingFields = (
    Object.keys(contentArchitectFieldLabels) as Array<
      keyof ContentArchitectInput
    >
  ).filter((field) => input[field].trim().length === 0);

  return {
    isValid: missingFields.length === 0,
    missingFields,
    message:
      missingFields.length === 0
        ? null
        : `Complete ${missingFields
            .map((field) => contentArchitectFieldLabels[field].toLowerCase())
            .join(", ")} before generating.`,
  };
}

type ArchitectSectionPayload = { title?: unknown; items?: unknown };
type GeneratedArchitectPayload = {
  summary?: unknown;
  contentPillars?: ArchitectSectionPayload[];
  weeklyThemes?: ArchitectSectionPayload[];
  postIdeas?: ArchitectSectionPayload[];
  contentFormats?: unknown;
  repurposingIdeas?: unknown;
  meta?: {
    weeklyThemes?: ArchitectSectionPayload[];
    postIdeas?: ArchitectSectionPayload[];
    contentFormats?: unknown;
    repurposingIdeas?: unknown;
  };
};

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asSections(value: unknown): ContentArchitectSection[] {
  if (!Array.isArray(value)) return [];
  const out: ContentArchitectSection[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const e = entry as ArchitectSectionPayload;
      const title = typeof e.title === "string" ? e.title : null;
      const items = asStrings(e.items);
      if (title) out.push({ title, items });
    }
  }
  return out;
}

function normalizeContentArchitect(
  generated: GeneratedArchitectPayload,
  input: ContentArchitectInput
): GeneratedContentArchitectPlan {
  const fallback = generateFallbackContentArchitect(input);
  const meta = generated.meta ?? {};

  return {
    summary:
      typeof generated.summary === "string" && generated.summary.trim()
        ? generated.summary
        : fallback.summary,
    contentPillars: asSections(generated.contentPillars).length
      ? asSections(generated.contentPillars)
      : fallback.contentPillars,
    weeklyThemes: asSections(generated.weeklyThemes ?? meta.weeklyThemes).length
      ? asSections(generated.weeklyThemes ?? meta.weeklyThemes)
      : fallback.weeklyThemes,
    postIdeas: asSections(generated.postIdeas ?? meta.postIdeas).length
      ? asSections(generated.postIdeas ?? meta.postIdeas)
      : fallback.postIdeas,
    contentFormats: asStrings(generated.contentFormats ?? meta.contentFormats).length
      ? asStrings(generated.contentFormats ?? meta.contentFormats)
      : fallback.contentFormats,
    repurposingIdeas: asStrings(
      generated.repurposingIdeas ?? meta.repurposingIdeas
    ).length
      ? asStrings(generated.repurposingIdeas ?? meta.repurposingIdeas)
      : fallback.repurposingIdeas,
  };
}

export async function generateContentArchitectPlan(
  input: ContentArchitectInput
): Promise<GeneratedContentArchitectPlan> {
  const res = await fetch("/api/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "content_architect",
      businessNiche: input.strategySummary,
      targetAudience: input.audience,
      contentGoals: input.contentGoal,
      offerProduct: input.offerProduct,
      preferredPlatforms: [input.platform],
      toneBrandStyle: input.tone,
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: { generated?: GeneratedArchitectPayload };
    error?: { message?: string };
  } | null;

  if (!res.ok || !json?.ok || !json.data?.generated) {
    throw new Error(json?.error?.message ?? `Architect request failed (${res.status})`);
  }

  return normalizeContentArchitect(json.data.generated, input);
}

function generateFallbackContentArchitect(
  input: ContentArchitectInput
): GeneratedContentArchitectPlan {
  const signals = splitStrategySignals(input.strategySummary);
  const goal = normalizeGoal(input.contentGoal);

  return {
    summary: `Turn the strategy into a ${input.platform} content plan for ${input.audience}, using a ${input.tone.toLowerCase()} voice to create momentum toward ${input.offerProduct}.`,
    contentPillars: [
      {
        title: "Problem Architecture",
        items: [
          `Name the recurring problem ${input.audience} is trying to solve.`,
          `Use ${signals[0]} as the anchor for founder-led point-of-view posts.`,
          `Connect the pain to the business cost behind ${goal}.`,
        ],
      },
      {
        title: "Strategic Method",
        items: [
          `Break ${input.offerProduct} into clear steps, decisions, or operating principles.`,
          `Translate ${signals[1] ?? signals[0]} into teachable frameworks.`,
          "Show the reasoning behind the system, not just the finished recommendation.",
        ],
      },
      {
        title: "Proof And Conversion",
        items: [
          `Use examples, teardown notes, and before-after logic to make ${input.offerProduct} tangible.`,
          `Answer the objections ${input.audience} would raise before taking the next step.`,
          "End each week with one conversion bridge tied to the offer.",
        ],
      },
    ],
    weeklyThemes: [
      {
        title: "Week 1: Name The Gap",
        items: [
          `Expose the hidden cost behind ${goal}.`,
          `Publish a strong belief about what ${input.audience} should stop doing.`,
          "Invite replies around the most expensive friction point.",
        ],
      },
      {
        title: "Week 2: Teach The System",
        items: [
          `Turn ${signals[2] ?? signals[0]} into a simple decision framework.`,
          `Show how the framework changes priorities on ${input.platform}.`,
          "Create one practical checklist that can become a saved asset.",
        ],
      },
      {
        title: "Week 3: Build Trust",
        items: [
          "Share proof, lessons learned, and behind-the-scenes reasoning.",
          `Make ${input.offerProduct} easier to understand without over-explaining it.`,
          "Use one post to compare old behavior with the stronger operating model.",
        ],
      },
      {
        title: "Week 4: Convert With Clarity",
        items: [
          `Clarify who ${input.offerProduct} is for and when it becomes urgent.`,
          "Handle the top objection with direct, founder-facing copy.",
          "Close with a clear next action for qualified prospects.",
        ],
      },
    ],
    postIdeas: [
      {
        title: "Authority Posts",
        items: [
          `The moment ${input.audience} realize their current system cannot support ${goal}.`,
          `A contrarian belief about ${signals[0]} and why it matters now.`,
          `The three decisions that make ${input.offerProduct} work better.`,
        ],
      },
      {
        title: "Education Posts",
        items: [
          `A step-by-step breakdown of how to approach ${signals[1] ?? signals[0]}.`,
          `A checklist ${input.audience} can use before investing in ${input.offerProduct}.`,
          "A teardown format that shows what to fix, keep, and ignore.",
        ],
      },
      {
        title: "Conversion Posts",
        items: [
          `Why waiting to solve ${goal} usually creates a more expensive problem.`,
          `What changes after ${input.audience} have the right content architecture in place.`,
          `A direct invitation tied to ${input.offerProduct}.`,
        ],
      },
    ],
    contentFormats: [
      `${input.platform} point-of-view post with one sharp thesis and one clear takeaway.`,
      "Framework carousel or short-form list that turns the strategy into a repeatable model.",
      "Teardown post that diagnoses a common mistake and shows the better path.",
      "Founder note that connects the strategy to lived experience or market observation.",
      "Offer bridge post that links the content plan back to the next buying step.",
    ],
    repurposingIdeas: [
      `Expand the strongest ${input.platform} post into a newsletter that deepens the strategy.`,
      "Turn the weekly theme into three short clips, one carousel, and one sales follow-up note.",
      "Collect the best audience replies into a future objection-handling post.",
      "Combine four weekly frameworks into a monthly guide or lead magnet.",
      `Use the proof posts as lightweight sales enablement for ${input.offerProduct}.`,
    ],
  };
}
