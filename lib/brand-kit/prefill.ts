import type { ExamplePost } from "@/lib/types";

/**
 * Maps a saved brand profile (GET /api/brand-profile, camelCase) onto the
 * Brand Kit wizard's form so the wizard edits what Architecta already knows
 * instead of starting blank — and so saving it never overwrites onboarding
 * intelligence with empty values.
 */

export type BrandKitPrefillSource = {
  brandName?: string | null;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  audience?: string | null;
  toneVoice?: string | null;
  voiceDescription?: string | null;
  topics?: unknown;
  bannedPhrases?: string[] | null;
  requiredElements?: string[] | null;
  examplePosts?: unknown;
};

export type BrandKitPrefill = {
  brandName: string;
  industry: string;
  website: string;
  description: string;
  demographics: string;
  toneAttributes: string[];
  voiceDescription: string;
  topicsInclude: string[];
  topicsAvoid: string[];
  bannedPhrases: string[];
  requiredElements: string[];
  examplePosts: ExamplePost[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function examplePosts(value: unknown): ExamplePost[] {
  if (!Array.isArray(value)) return [];
  const out: ExamplePost[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const post = entry as Record<string, unknown>;
    const id = text(post.id);
    const content = text(post.content);
    if (!id || !content) continue;
    out.push({
      id,
      type: text(post.type) || "post",
      content,
      whyItWorks: text(post.whyItWorks),
    });
  }
  return out;
}

export function brandKitPrefillFromProfile(profile: BrandKitPrefillSource | null): Partial<BrandKitPrefill> {
  if (!profile) return {};

  const topics =
    profile.topics && typeof profile.topics === "object" && !Array.isArray(profile.topics)
      ? (profile.topics as Record<string, unknown>)
      : {};

  const prefill: BrandKitPrefill = {
    brandName: text(profile.brandName),
    industry: text(profile.industry),
    website: text(profile.website),
    description: text(profile.description),
    demographics: text(profile.audience),
    toneAttributes: text(profile.toneVoice)
      .split(",")
      .map((attribute) => attribute.trim())
      .filter(Boolean),
    voiceDescription: text(profile.voiceDescription),
    topicsInclude: strings(topics.include),
    topicsAvoid: strings(topics.avoid),
    bannedPhrases: strings(profile.bannedPhrases),
    requiredElements: strings(profile.requiredElements),
    examplePosts: examplePosts(profile.examplePosts),
  };

  // Only keep what is actually known; empty values never replace form state.
  return Object.fromEntries(
    Object.entries(prefill).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== ""
    )
  ) as Partial<BrandKitPrefill>;
}

function isEmptyValue(value: unknown) {
  if (Array.isArray(value)) return value.every((entry) => (typeof entry === "string" ? !entry.trim() : !entry));
  return typeof value === "string" ? value.trim() === "" : value == null;
}

/** Applies a prefill only to fields the user hasn't filled in yet. */
export function mergeBrandKitPrefill<T extends object>(current: T, prefill: Partial<BrandKitPrefill>): T {
  const existing = current as Record<string, unknown>;
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(prefill)) {
    if (value !== undefined && key in existing && isEmptyValue(existing[key])) {
      next[key] = value;
    }
  }
  return next as T;
}
