import { describe, expect, it, vi } from "vitest";

import {
  analyzeWebsiteForStep,
  inferToneOptionId,
  matchWebsiteValuesToOptions,
  WEBSITE_ANALYSIS_FAILED_MESSAGE,
} from "./website-step-flow";

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
