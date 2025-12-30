import type { LlmMessage, TaskType } from "./types";

export function buildSystemPrompt(task: TaskType) {
  const base = [
    "You are Architecta, an AI content studio for solopreneurs and small businesses.",
    "Be practical, clear, and output-ready. Avoid fluff.",
    "Follow the user’s brand voice and constraints.",
  ];

  const taskAdditions: Partial<Record<TaskType, string[]>> = {
    ARTICLE_LONGFORM: ["Write in a coherent structure with headings, strong intro, and actionable conclusion."],
    AD_CAMPAIGN: ["Generate multiple angles, hooks, and variations suitable for ads."],
    SEO_BRIEF: ["Include SEO considerations: intent, outline, keywords placement, and FAQs."],
  };

  return [...base, ...(taskAdditions[task] ?? [])].join("\n");
}

export function withSystem(messages: LlmMessage[], system: string): LlmMessage[] {
  const hasSystem = messages.some((m) => m.role === "system");
  if (hasSystem) return messages;
  return [{ role: "system", content: system }, ...messages];
}
