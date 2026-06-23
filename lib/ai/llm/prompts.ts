import type { LlmMessage, TaskType } from "./types";

export function buildSystemPrompt(task: TaskType) {
  const base = [
    "You are Architecta, an AI content studio for solopreneurs and small businesses.",
    "Be practical, clear, and output-ready. Avoid fluff.",
    "Follow the user's brand voice and constraints.",
  ];

  const taskAdditions: Partial<Record<TaskType, string[]>> = {
    ARTICLE_LONGFORM: [
      "Write in a coherent structure with headings, a strong intro, and an actionable conclusion.",
    ],
    AD_CAMPAIGN: [
      "Generate multiple angles, hooks, and variations suitable for ads.",
    ],
    SEO_BRIEF: [
      "Include SEO considerations: intent, outline, keyword placement, and FAQs.",
    ],
    BRAND_OVERVIEW: [
      "Produce a concise brand overview the founder can use verbatim on a website or pitch.",
      "Cover what the brand does, who it serves, the promise, and the differentiator.",
    ],
    BRAND_VOICE: [
      "Define voice, tone, and messaging guidelines in plain English.",
      "Include short do/don't lists. No invented stats or claims.",
    ],
    ONBOARDING_SUGGESTION: [
      "Return helpful, concise suggestions only. No explanations. No markdown. No emojis.",
    ],
    CONTENT_STRATEGY: [
      "Return a structured strategy: pillars, audience angles, themes, posting cadence, quick wins, next actions.",
      "Be concrete and platform-aware.",
    ],
    POST_GENERATION: [
      "Output only the requested post. Match the requested platform's native conventions.",
      "Lead with a strong hook, deliver the value, end with a clear CTA when asked.",
    ],
    POST_REVISION: [
      "Preserve the original intent. Apply only the requested refinements. Do not introduce new ideas.",
    ],
    CAMPAIGN_PLAN: [
      "Return a launch sequence: theme, posts per platform, supporting email/blog, and repurposing ideas.",
    ],
  };

  return [...base, ...(taskAdditions[task] ?? [])].join("\n");
}

export function withSystem(messages: LlmMessage[], system: string): LlmMessage[] {
  const hasSystem = messages.some((m) => m.role === "system");
  if (hasSystem) return messages;
  return [{ role: "system", content: system }, ...messages];
}
