import { describe, expect, it, vi } from "vitest";

import {
  analyzeWebsiteForStep,
  composeWebsiteAnalysis,
  confidentWebsiteValue,
  fillUntouchedEmptyFields,
  inferToneOptionId,
  initialStepValue,
  isWebsiteAnalysisPending,
  matchWebsiteValuesToOptions,
  snapshotWebsiteSuggestions,
  WEBSITE_ANALYSIS_FAILED_MESSAGE,
  websiteToneSuggestion,
  websiteValueSuggestions,
} from "./website-step-flow";
import type { OnboardingAnswers, WebsiteAnalysisResult } from "./persistence";

const VALUE_OPTIONS = [
  "Clarity",
  "Integrity",
  "Innovation",
  "Trust",
  "Empathy",
  "Boldness",
  "Simplicity",
  "Excellence",
];

describe("inferToneOptionId", () => {
  it("matches 'direct' before other keywords when several are present", () => {
    expect(inferToneOptionId("Direct, confident, practical", "Clear, no-fluff, founder-to-founder")).toBe(
      "direct"
    );
  });

  it("matches bold/friendly/inspiring/calm tones", () => {
    expect(inferToneOptionId("Bold and assertive", undefined)).toBe("bold");
    expect(inferToneOptionId("Warm and conversational", undefined)).toBe("friendly");
    expect(inferToneOptionId("Aspirational and visionary", undefined)).toBe("inspiring");
    expect(inferToneOptionId("Calm, thoughtful, measured", undefined)).toBe("calm");
  });

  it("falls back to the voice_characteristics field when tone alone doesn't match", () => {
    expect(inferToneOptionId("Professional", "no-fluff and straightforward")).toBe("direct");
  });

  it("returns undefined when nothing matches, so the step asks the user", () => {
    expect(inferToneOptionId("Professional", undefined)).toBeUndefined();
    expect(inferToneOptionId(undefined, undefined)).toBeUndefined();
    expect(inferToneOptionId("", "")).toBeUndefined();
  });
});

describe("matchWebsiteValuesToOptions", () => {
  it("matches exact, comma-separated values against the option list", () => {
    expect(matchWebsiteValuesToOptions("Clarity, Integrity, Simplicity", VALUE_OPTIONS)).toEqual([
      "Clarity",
      "Integrity",
      "Simplicity",
    ]);
  });

  it("matches values joined with 'and'", () => {
    expect(matchWebsiteValuesToOptions("Trust and Empathy", VALUE_OPTIONS)).toEqual(["Trust", "Empathy"]);
  });

  it("ignores values with no corresponding option instead of inventing one", () => {
    expect(matchWebsiteValuesToOptions("Sustainability, Craftsmanship", VALUE_OPTIONS)).toEqual([]);
  });

  it("returns an empty array when there is nothing to match", () => {
    expect(matchWebsiteValuesToOptions(undefined, VALUE_OPTIONS)).toEqual([]);
    expect(matchWebsiteValuesToOptions("", VALUE_OPTIONS)).toEqual([]);
  });

  it("caps matches at maxMatches (default 5)", () => {
    const result = matchWebsiteValuesToOptions(
      "Clarity, Integrity, Innovation, Trust, Empathy, Boldness, Simplicity, Excellence",
      VALUE_OPTIONS
    );
    expect(result).toHaveLength(5);
  });

  it("does not duplicate an option matched by more than one token", () => {
    expect(matchWebsiteValuesToOptions("Trust, Trustworthy", VALUE_OPTIONS)).toEqual(["Trust"]);
  });
});

describe("confidentWebsiteValue", () => {
  it("returns the value at high or medium confidence", () => {
    expect(confidentWebsiteValue("Acme", "high")).toBe("Acme");
    expect(confidentWebsiteValue("Acme", "medium")).toBe("Acme");
  });

  it("treats a low-confidence analysis as context only, not an answer", () => {
    expect(confidentWebsiteValue("Acme", "low")).toBeUndefined();
  });

  it("returns undefined for an absent or empty value regardless of confidence", () => {
    expect(confidentWebsiteValue(undefined, "high")).toBeUndefined();
    expect(confidentWebsiteValue("", "high")).toBeUndefined();
  });

  it("returns undefined when confidence itself is absent", () => {
    expect(confidentWebsiteValue("Acme", undefined)).toBeUndefined();
  });

  it("passes through non-string values (e.g. arrays) unchanged when confident", () => {
    expect(confidentWebsiteValue(["a", "b"], "high")).toEqual(["a", "b"]);
  });
});

describe("analyzeWebsiteForStep", () => {
  it("resolves ok and toggles the analyzing state on success", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi.fn().mockResolvedValue({ ok: true });

    const outcome = await analyzeWebsiteForStep("https://acme.com", { analyze, setAnalyzing });

    expect(outcome).toEqual({ ok: true });
    expect(analyze).toHaveBeenCalledWith("https://acme.com");
    expect(setAnalyzing.mock.calls).toEqual([[true], [false]]);
  });

  it("surfaces the server's safe error and resets the analyzing state", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi
      .fn()
      .mockResolvedValue({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });

    const outcome = await analyzeWebsiteForStep("https://acme.com", { analyze, setAnalyzing });

    expect(outcome).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
    expect(setAnalyzing).toHaveBeenLastCalledWith(false);
  });

  it("never rethrows: a rejected server action becomes a safe failure", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi
      .fn()
      .mockRejectedValue(new Error("Incorrect API key provided: sk-proj-abc123456"));

    const outcome = await analyzeWebsiteForStep("https://acme.com", { analyze, setAnalyzing });

    expect(outcome).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
    expect(JSON.stringify(outcome)).not.toContain("sk-proj");
    expect(setAnalyzing).toHaveBeenLastCalledWith(false);
  });

  it("falls back to the safe message when the server returns no error text", async () => {
    const outcome = await analyzeWebsiteForStep("https://acme.com", {
      analyze: vi.fn().mockResolvedValue({ ok: false }),
      setAnalyzing: vi.fn(),
    });

    expect(outcome).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("uses a message that offers retry and manual continuation", () => {
    expect(WEBSITE_ANALYSIS_FAILED_MESSAGE).toBe(
      "We couldn't analyze your website automatically. You can try again or continue manually."
    );
  });
});

/* =======================================================
   Precedence + confidence (background analysis)
======================================================= */

function analysis(overrides: Partial<WebsiteAnalysisResult> = {}): WebsiteAnalysisResult {
  return {
    brand_name: "Acme Studio",
    industry: "B2B SaaS",
    description: "Content systems for founders",
    tone: "Direct and practical",
    voice_characteristics: "No-fluff",
    values: "Clarity, Integrity",
    confidence: "high",
    analyzed_at: "2026-09-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("initialStepValue", () => {
  it("the user's (or saved shared/brand) answer wins over a website suggestion", () => {
    expect(initialStepValue("My own name", "Acme Studio", "")).toBe("My own name");
    expect(initialStepValue(["Trust"], ["Clarity"], [])).toEqual(["Trust"]);
  });

  it("an explicitly saved empty answer still wins — a late suggestion never replaces it", () => {
    expect(initialStepValue("", "Acme Studio", "")).toBe("");
  });

  it("a confident website value fills an empty field, else the field stays empty", () => {
    expect(initialStepValue(undefined, "Acme Studio", "")).toBe("Acme Studio");
    expect(initialStepValue<string>(undefined, undefined, "")).toBe("");
  });
});

describe("confidence-gated suggestions", () => {
  it("Foundation: a low-confidence analysis does not pre-select values", () => {
    expect(websiteValueSuggestions(analysis({ confidence: "low" }), VALUE_OPTIONS)).toEqual([]);
    expect(websiteValueSuggestions(analysis({ confidence: "medium" }), VALUE_OPTIONS)).toEqual(["Clarity", "Integrity"]);
  });

  it("Voice: a low-confidence analysis does not pre-select a tone", () => {
    expect(websiteToneSuggestion(analysis({ confidence: "low" }))).toBeUndefined();
    expect(websiteToneSuggestion(analysis({ confidence: "high" }))).toBe("direct");
  });

  it("Snapshot: a low-confidence analysis suggests nothing", () => {
    expect(snapshotWebsiteSuggestions(analysis({ confidence: "low" }))).toEqual({
      brandName: undefined,
      industry: undefined,
      description: undefined,
    });
  });

  it("no analysis yet suggests nothing", () => {
    expect(websiteValueSuggestions(undefined, VALUE_OPTIONS)).toEqual([]);
    expect(websiteToneSuggestion(null)).toBeUndefined();
  });
});

describe("fillUntouchedEmptyFields (Snapshot live result)", () => {
  const untouched = { brandName: false, industry: false, description: false };
  const suggestions = snapshotWebsiteSuggestions(analysis());

  it("fills only fields that are still empty and untouched", () => {
    const next = fillUntouchedEmptyFields(
      { brandName: "", industry: "Coaching", description: "" },
      untouched,
      suggestions
    );
    expect(next).toEqual({
      brandName: "Acme Studio",
      industry: "Coaching",
      description: "Content systems for founders",
    });
  });

  it("never replaces typed text, and never refills a field the user cleared", () => {
    const next = fillUntouchedEmptyFields(
      { brandName: "Typed name", industry: "", description: "" },
      { brandName: true, industry: true, description: false },
      suggestions
    );
    expect(next).toEqual({ brandName: "Typed name", industry: "", description: "Content systems for founders" });
  });

  it("does nothing with a low-confidence result", () => {
    const empty = { brandName: "", industry: "", description: "" };
    expect(fillUntouchedEmptyFields(empty, untouched, snapshotWebsiteSuggestions(analysis({ confidence: "low" })))).toEqual(empty);
  });
});

describe("composeWebsiteAnalysis (read-time)", () => {
  it("exposes a completed job result as answers.website_analysis without mutating answers", () => {
    const answers: OnboardingAnswers = { brand_name: "Mine" };
    const composed = composeWebsiteAnalysis(answers, { status: "completed", result: analysis() });

    expect(composed.website_analysis?.brand_name).toBe("Acme Studio");
    expect(composed.brand_name).toBe("Mine");
    expect(answers).toEqual({ brand_name: "Mine" });
  });

  it("ignores pending/failed jobs and keeps an older inline analysis as a fallback", () => {
    const legacy = analysis({ brand_name: "Legacy" });
    const empty: OnboardingAnswers = {};
    expect(composeWebsiteAnalysis<OnboardingAnswers>({ website_analysis: legacy }, { status: "processing", result: null }).website_analysis).toBe(legacy);
    expect(composeWebsiteAnalysis(empty, { status: "failed", result: null }).website_analysis).toBeUndefined();
    expect(composeWebsiteAnalysis(empty, null).website_analysis).toBeUndefined();
  });
});

describe("isWebsiteAnalysisPending", () => {
  it("polls only while queued or processing", () => {
    expect(isWebsiteAnalysisPending("queued")).toBe(true);
    expect(isWebsiteAnalysisPending("processing")).toBe(true);
    expect(isWebsiteAnalysisPending("completed")).toBe(false);
    expect(isWebsiteAnalysisPending("failed")).toBe(false);
    expect(isWebsiteAnalysisPending(null)).toBe(false);
  });
});
