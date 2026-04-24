import type { ContentType, LlmMessage, TaskType } from "../types";

/* ======================================================
   Content-Specific Prompt Hints
   ====================================================== */

const CONTENT_HINTS: Record<ContentType, string[]> = {
  tweet: [
    "Keep it concise and punchy.",
    "Optimize for engagement and clarity.",
  ],

  thread: [
    "Use a strong hook in the first post.",
    "Ensure logical flow across points.",
  ],

  linkedin: [
    "Maintain a professional yet conversational tone.",
    "Focus on insight, not promotion.",
  ],

  linkedin_post: [
    "Maintain a professional yet conversational tone.",
    "Focus on insight, not promotion.",
  ],

  blog: [
    "Write with clarity and authority.",
    "Include actionable takeaways.",
  ],

  blog_outline: [
    "Organize content into clear sections.",
    "Ensure logical progression of ideas.",
  ],

  blog_post: [
    "Write with clarity and authority.",
    "Include actionable takeaways.",
  ],

  article_longform: [
    "Write in a coherent structure with headings.",
    "Include a strong introduction and actionable conclusion.",
  ],

  email: [
    "Keep it direct and conversational.",
    "Include a clear CTA.",
  ],

  ad_copy: [
    "Focus on benefits, not features.",
    "Use compelling, action-oriented language.",
  ],

  ad: [
    "Focus on benefits, not features.",
    "Use compelling, action-oriented language.",
  ],

  landing_page: [
    "Lead with a strong value proposition.",
    "Reinforce trust and credibility.",
  ],

  product_description: [
    "Clearly describe the product’s benefits.",
    "Use scannable formatting.",
  ],
};

/* ======================================================
   Task-Specific Prompt Hints
   ====================================================== */

const TASK_HINTS: Record<TaskType, string[]> = {
  generate: [
    "Produce original, high-quality output aligned with the request.",
  ],

  refine: [
    "Improve clarity, tone, and effectiveness without changing intent.",
  ],

  expand: [
    "Add depth, examples, and detail while preserving structure.",
  ],

  summarize: [
    "Condense content while preserving key points and intent.",
  ],

  translate: [
    "Translate accurately while preserving tone and meaning.",
  ],
};

/* ======================================================
   System Prompt Builder
   ====================================================== */

export function buildSystemPrompt(
  task: TaskType,
  contentType?: ContentType
): string {
  const base: string[] = [
    "You are Architecta, an AI content studio for solopreneurs and small businesses.",
    "Be practical, clear, and output-ready. Avoid fluff.",
    "Follow the user’s brand voice and constraints.",
  ];

  const taskHints = TASK_HINTS[task] ?? [];
  const contentHints = contentType ? CONTENT_HINTS[contentType] ?? [] : [];

  return [...base, ...taskHints, ...contentHints].join("\n");
}

/* ======================================================
   System Message Injector
   ====================================================== */

export function withSystem(
  messages: LlmMessage[],
  system: string
): LlmMessage[] {
  const hasSystem = messages.some((m) => m.role === "system");
  if (hasSystem) return messages;

  return [{ role: "system", content: system }, ...messages];
}
