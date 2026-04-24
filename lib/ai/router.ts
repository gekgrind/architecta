import { generateWithClaude } from "./actions/anthropic";
import { generateWithOpenAI } from "./actions/openai";

type TaskType =
  | "brand_overview"
  | "brand_voice"
  | "brand_story"
  | "templates"
  | "short_copy";

export async function runAI({
  task,
  prompt,
  preferClaude,
}: {
  task: TaskType;
  prompt: string;
  preferClaude?: boolean;
}) {
  const longFormTasks: TaskType[] = [
    "brand_overview",
    "brand_voice",
    "brand_story",
  ];

  if (preferClaude && longFormTasks.includes(task)) {
    const res = await generateWithClaude(prompt);
    if (res.ok) return res.text;
  }

  // fallback or default
  return generateWithOpenAI(prompt);
}
