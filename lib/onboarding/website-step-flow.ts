/* =======================================================
   Website step: client-safe analysis flow

   Shared by the WebsiteStep component (client) and website-analysis
   (server). Must not import server-only modules.
======================================================= */

export const WEBSITE_ANALYSIS_FAILED_MESSAGE =
  "We couldn't analyze your website automatically. You can try again or continue manually.";

export type WebsiteAnalysisOutcome = { ok: true } | { ok: false; error: string };

type AnalyzeResult = { ok: true } | { ok: false; error?: string };

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
