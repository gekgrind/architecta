/* =======================================================
   Website step: client-safe analysis flow

   Shared by the WebsiteStep component (client) and website-analysis
   (server). Must not import server-only modules.
======================================================= */

import type { WebsiteAnalysisResult } from "./persistence";

export const WEBSITE_ANALYSIS_FAILED_MESSAGE =
  "We couldn't analyze your website automatically. You can try again or continue manually.";

export type WebsiteAnalysisOutcome = { ok: true } | { ok: false; error: string };

type AnalyzeResult = { ok: true } | { ok: false; error?: string };

/**
 * Gates a website-derived value on the analysis's own confidence: a "low"
 * confidence analysis is treated as context only, never a silent answer.
 * Empty/falsy values are treated as absent regardless of confidence.
 */
export function confidentWebsiteValue<T>(
  value: T | undefined,
  confidence: WebsiteAnalysisResult["confidence"] | undefined
): T | undefined {
  if (!value) return undefined;
  if (confidence !== "high" && confidence !== "medium") return undefined;
  return value;
}

/* =======================================================
   Website-derived suggestions → step field inference

   The AI analysis returns free-text (tone, values) that doesn't line up
   1:1 with the fixed option lists steps present to the user. These map
   analysis text onto those options so a strong signal pre-selects an
   answer instead of only being echoed back as an unused notice.
======================================================= */

const TONE_OPTION_KEYWORDS: { id: string; keywords: string[] }[] = [
  { id: "direct", keywords: ["direct", "no-fluff", "no fluff", "blunt", "straightforward", "matter-of-fact", "practical"] },
  { id: "bold", keywords: ["bold", "confident", "assertive", "daring", "punchy"] },
  { id: "friendly", keywords: ["friendly", "warm", "conversational", "approachable", "welcoming", "casual"] },
  { id: "inspiring", keywords: ["inspiring", "aspirational", "motivating", "uplifting", "visionary"] },
  { id: "calm", keywords: ["calm", "thoughtful", "gentle", "soothing", "measured", "reflective"] },
];

/**
 * Maps the analyzer's free-text tone/voice fields onto one of the Voice
 * step's fixed tone option ids. Returns undefined when nothing matches
 * confidently, so the step falls back to asking the user.
 */
export function inferToneOptionId(
  websiteTone: string | undefined,
  voiceCharacteristics: string | undefined
): string | undefined {
  const haystack = `${websiteTone ?? ""} ${voiceCharacteristics ?? ""}`.toLowerCase().trim();
  if (!haystack) return undefined;

  for (const { id, keywords } of TONE_OPTION_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return id;
    }
  }
  return undefined;
}

/**
 * Matches the analyzer's free-text "values" field against a step's fixed
 * value options (e.g. Foundation step's checkbox list), so explicit
 * website values pre-select the matching checkboxes instead of being
 * silently discarded. Returns option labels exactly as given in `options`.
 */
export function matchWebsiteValuesToOptions(
  websiteValues: string | undefined,
  options: string[],
  maxMatches = 5
): string[] {
  if (!websiteValues) return [];

  const tokens = websiteValues
    .split(/[,;/]|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean);

  const matched: string[] = [];
  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    for (const option of options) {
      if (matched.includes(option)) continue;
      const optionLower = option.toLowerCase();
      if (tokenLower === optionLower || tokenLower.includes(optionLower) || optionLower.includes(tokenLower)) {
        matched.push(option);
      }
    }
  }

  return matched.slice(0, maxMatches);
}

/* =======================================================
   Confidence-gated website suggestions + precedence

   Precedence for every step field:
     saved answer (user's own, or shared/brand-profile prefill already
     merged into answers) > confident website analysis > empty.
   A "low" confidence analysis never auto-fills anything.
======================================================= */

/** First defined value wins: the saved answer always beats a website suggestion. */
export function initialStepValue<T>(saved: T | undefined, suggestion: T | undefined, empty: T): T {
  return saved ?? suggestion ?? empty;
}

/** Voice step tone option suggested by a confident analysis. */
export function websiteToneSuggestion(wa: WebsiteAnalysisResult | null | undefined): string | undefined {
  return inferToneOptionId(
    confidentWebsiteValue(wa?.tone, wa?.confidence),
    confidentWebsiteValue(wa?.voice_characteristics, wa?.confidence)
  );
}

/** Foundation step value options suggested by a confident analysis. */
export function websiteValueSuggestions(
  wa: WebsiteAnalysisResult | null | undefined,
  options: string[]
): string[] {
  return matchWebsiteValuesToOptions(confidentWebsiteValue(wa?.values, wa?.confidence), options);
}

export type SnapshotFields = { brandName: string; industry: string; description: string };

/** Snapshot fields a confident analysis can suggest. */
export function snapshotWebsiteSuggestions(
  wa: WebsiteAnalysisResult | null | undefined
): Partial<SnapshotFields> {
  return {
    brandName: confidentWebsiteValue(wa?.brand_name, wa?.confidence),
    industry: confidentWebsiteValue(wa?.industry, wa?.confidence),
    description: confidentWebsiteValue(wa?.description, wa?.confidence),
  };
}

/**
 * A late analysis result only fills a Snapshot field the user has neither
 * touched nor filled. Typed (or cleared) text is never replaced.
 */
export function fillUntouchedEmptyFields(
  current: SnapshotFields,
  touched: Record<keyof SnapshotFields, boolean>,
  suggestions: Partial<SnapshotFields>
): SnapshotFields {
  const next = { ...current };
  for (const key of Object.keys(next) as (keyof SnapshotFields)[]) {
    const suggestion = suggestions[key];
    if (!touched[key] && next[key].trim() === "" && suggestion) next[key] = suggestion;
  }
  return next;
}

/* =======================================================
   Background analysis: read-time composition + polling
======================================================= */

export type WebsiteAnalysisStatus = "queued" | "processing" | "completed" | "failed";

/**
 * Exposes a completed background analysis to steps as answers.website_analysis
 * WITHOUT persisting it into the session's answers. The job table stays the
 * source of truth; an older inline analysis in answers is kept as a fallback.
 */
export function composeWebsiteAnalysis<A extends { website_analysis?: WebsiteAnalysisResult | null }>(
  answers: A,
  job: { status: WebsiteAnalysisStatus; result: WebsiteAnalysisResult | null } | null
): A {
  if (job?.status === "completed" && job.result) {
    return { ...answers, website_analysis: job.result };
  }
  return answers;
}

export const WEBSITE_ANALYSIS_POLL_INTERVAL_MS = 4_000;
/** Covers the typical GLM attempt; later steps pick up anything slower at render. */
export const WEBSITE_ANALYSIS_POLL_MAX_MS = 150_000;

export function isWebsiteAnalysisPending(status: WebsiteAnalysisStatus | null | undefined): boolean {
  return status === "queued" || status === "processing";
}

/**
 * Runs the website analysis server action and always resolves: a rejected
 * action (network drop, server crash) becomes a user-safe failure, and
 * `setAnalyzing(false)` is guaranteed so the step never stays stuck.
 */
export async function analyzeWebsiteForStep(
  url: string,
  deps: {
    analyze: (url: string) => Promise<AnalyzeResult>;
    setAnalyzing: (analyzing: boolean) => void;
  }
): Promise<WebsiteAnalysisOutcome> {
  deps.setAnalyzing(true);
  try {
    const result = await deps.analyze(url);
    if (result.ok) return { ok: true };
    return { ok: false, error: result.error || WEBSITE_ANALYSIS_FAILED_MESSAGE };
  } catch {
    return { ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE };
  } finally {
    deps.setAnalyzing(false);
  }
}
