/* =======================================================
   Website step: client-safe analysis flow

   Shared by the WebsiteStep component (client) and website-analysis
   (server). Must not import server-only modules.
======================================================= */

export const WEBSITE_ANALYSIS_FAILED_MESSAGE =
  "We couldn't analyze your website automatically. You can try again or continue manually.";

export type WebsiteAnalysisOutcome = { ok: true } | { ok: false; error: string };

type AnalyzeResult = { ok: true } | { ok: false; error?: string };

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
