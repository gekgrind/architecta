// /lib/ai/prompts/builders.ts

import type {
  BrandKit,
  BuiltPrompt,
  ChatMessage,
  PromptBuildOptions,
  Platform,
  RevisionControls,
} from "./types";

function compactList(items?: string[], max = 12) {
  if (!items?.length) return "None provided";
  return items.slice(0, max).map((s) => `- ${s}`).join("\n");
}

function compactExamples(examples?: string[], max = 3) {
  if (!examples?.length) return "None provided";
  return examples.slice(0, max).map((s, i) => `${i + 1}) ${s}`).join("\n");
}

function systemPrompt(opts: PromptBuildOptions): string {
  const strictNoEmojis = opts.strictNoEmojis ?? true;
  const allowHashtags = opts.allowHashtags ?? false;

  return [
    `You are Architecta, an AI content strategist for solopreneurs, founders, and small businesses.`,
    ``,
    `Your job is to create clear, persuasive, high-quality marketing content that:`,
    `- Sounds human, confident, and modern`,
    `- Avoids hype, buzzwords, and clichés`,
    `- Prioritizes clarity over cleverness`,
    `- Is optimized for the platform it’s written for`,
    ``,
    `You think like a strategist, write like a copywriter, and edit like a human.`,
    ``,
    `Hard rules:`,
    strictNoEmojis ? `- Do not use emojis unless explicitly requested.` : `- Emojis are allowed if tasteful and minimal.`,
    allowHashtags ? `- Hashtags are allowed if natural.` : `- Do not use hashtags unless explicitly allowed.`,
    `- Never overpromise results.`,
    `- If user context is missing, make reasonable assumptions and keep it generic.`,
  ].join("\n");
}

function brandPrompt(brand: BrandKit): string {
  return [
    `Brand Context`,
    `Brand Name: ${brand.brandName || "Unknown"}`,
    `Audience: ${brand.audience || "Not provided"}`,
    `Tone: ${brand.tone || "Not provided"}`,
    `Topics:\n${compactList(brand.topics)}`,
    `Banned Phrases:\n${compactList(brand.bannedPhrases)}`,
    `Writing Examples:\n${compactExamples(brand.examples)}`,
    ``,
    `If there is a conflict, always follow the brand tone and examples.`,
  ].join("\n");
}

/** Shared “input payload” format for all tasks */
function studioInputPrompt(opts: PromptBuildOptions): string {
  const { gen } = opts;

  return [
    `Studio Input`,
    `Platform: ${gen.platform}`,
    `Idea: ${gen.idea}`,
    gen.goal ? `Goal: ${gen.goal}` : `Goal: Not provided`,
    gen.context ? `Context: ${gen.context}` : `Context: Not provided`,
    gen.email?.primaryCta ? `Primary CTA: ${gen.email.primaryCta}` : ``,
  ]
    .filter(Boolean)
    .join("\n");
}

function revisionPrompt(rev?: RevisionControls): string | null {
  if (!rev) return null;

  const tone = rev.tone ?? "clearer";
  const length = rev.length ?? "same";
  const ctaStrength = rev.ctaStrength ?? "subtle";
  const complexity = rev.complexity ?? "same";

  return [
    `Revision Controls`,
    `Revise the content with these adjustments:`,
    `- Tone: ${tone}`,
    `- Length: ${length}`,
    `- CTA Strength: ${ctaStrength}`,
    `- Complexity: ${complexity}`,
    ``,
    `Only change what is necessary.`,
  ].join("\n");
}

/** Task templates */
function taskPrompt(platform: Platform, opts: PromptBuildOptions): string {
  switch (platform) {
    case "x_post":
      return [
        `Write a short, high-impact X (Twitter) post.`,
        ``,
        `Constraints:`,
        `- Max 280 characters`,
        `- One clear idea`,
        `- Conversational, not salesy`,
        `- No hashtags`,
        ``,
        `Goal: Stop the scroll and make the reader think or nod “yep.”`,
        `End with either:`,
        `- A subtle insight`,
        `- A light CTA (question or reflection)`,
        ``,
        `Avoid: buzzwords, corporate language.`,
      ].join("\n");

    case "x_thread":
      return [
        `Write a concise X thread (5–7 tweets).`,
        ``,
        `Structure:`,
        `1. Hook that creates curiosity or tension`,
        `2–6. Clear, skimmable insights (one idea per tweet)`,
        `Final tweet: soft takeaway or question`,
        ``,
        `Style:`,
        `- Plainspoken`,
        `- Founder-to-founder tone`,
        `- Confident but not arrogant`,
        ``,
        `No hashtags. No emojis. No fluff.`,
        `Output format: Number each tweet like "1/ ...", "2/ ...", etc.`,
      ].join("\n");

    case "linkedin_post":
      return [
        `Write a LinkedIn post from the perspective of a founder or operator.`,
        ``,
        `Length: 120–250 words`,
        ``,
        `Structure:`,
        `- Relatable opening (problem, realization, or moment)`,
        `- 2–4 short paragraphs with spacing`,
        `- One grounded takeaway`,
        ``,
        `Tone: professional but human. No hustle-bro energy.`,
        `Avoid: “Thrilled to announce,” excessive emojis, generic motivation.`,
      ].join("\n");

    case "marketing_email": {
      const from = opts.gen.email?.fromName || "Me";
      const fromBrand = opts.gen.email?.fromBrand || opts.brand.brandName || "our brand";
      const cta = opts.gen.email?.primaryCta || "Reply and tell me what you’re building.";

      return [
        `Write a marketing email that feels personal, not promotional.`,
        ``,
        `From: ${from} (${fromBrand})`,
        ``,
        `Structure:`,
        `- Subject line (curiosity-driven, not clickbait)`,
        `- Short opening line`,
        `- 1–2 insights or a short story`,
        `- Soft CTA at the end`,
        ``,
        `Constraints:`,
        `- Conversational`,
        `- No hype`,
        `- Reads like it was written to one person`,
        ``,
        `CTA to include: ${cta}`,
        ``,
        `Output format:`,
        `Subject: ...`,
        `Body: ...`,
      ].join("\n");
    }

    case "blog_outline":
      return [
        `Create a blog post outline.`,
        ``,
        `Include:`,
        `- Clear H1`,
        `- 5–7 H2 sections`,
        `- Bullet points under each H2 explaining what to cover`,
        ``,
        `Goal: educate and build trust, not just rank.`,
        `Avoid: generic “ultimate guide” phrasing.`,
      ].join("\n");

    case "ad_angles":
      return [
        `Generate 5 distinct ad angles.`,
        ``,
        `Each angle must include:`,
        `- Hook (1 sentence)`,
        `- Core message`,
        `- Emotional trigger (fear, clarity, relief, curiosity)`,
        ``,
        `Tone: smart, confident, not pushy.`,
        `Avoid: overpromising or sounding like a scam ad.`,
        ``,
        `Output format:`,
        `Angle 1:`,
        `Hook: ...`,
        `Message: ...`,
        `Trigger: ...`,
        ``,
        `(repeat through Angle 5)`,
      ].join("\n");

    default:
      // Exhaustive check
      const _never: never = platform;
      return _never;
  }
}

export function buildPrompt(opts: PromptBuildOptions): BuiltPrompt {
  const { brand, gen, revision } = opts;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(opts) },
    {
      role: "user",
      content: [brandPrompt(brand), "", studioInputPrompt(opts), "", taskPrompt(gen.platform, opts)]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const rev = revisionPrompt(revision);
  if (rev) {
    messages.push({ role: "user", content: rev });
  }

  // modelHint is optional—set it once you decide per tier
  return {
    modelHint: "gpt-5-mini",
    messages,
    metadata: {
      platform: gen.platform,
      brandName: brand.brandName,
    },
  };
}

/**
 * Helper for "Revise existing draft" without regenerating from scratch.
 * Feed your previous draft and desired revision controls.
 */
export function buildRevisionOnlyPrompt(args: {
  brand: BrandKit;
  platform: Platform;
  draft: string;
  revision: RevisionControls;
  strictNoEmojis?: boolean;
  allowHashtags?: boolean;
}): BuiltPrompt {
  const opts: PromptBuildOptions = {
    brand: args.brand,
    gen: {
      platform: args.platform,
      idea: "Revise the existing draft below.",
      context: "Keep the same core meaning, improve according to the revision controls.",
    },
    revision: args.revision,
    strictNoEmojis: args.strictNoEmojis,
    allowHashtags: args.allowHashtags,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(opts) },
    { role: "user", content: brandPrompt(args.brand) },
    {
      role: "user",
      content: [
        `Existing Draft`,
        `---`,
        args.draft,
        `---`,
        ``,
        `Now revise this draft using the revision controls below.`,
        revisionPrompt(args.revision) || "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  return {
    modelHint: "gpt-5-mini",
    messages,
    metadata: { platform: args.platform, brandName: args.brand.brandName },
  };
}
