import { describe, expect, it, vi } from "vitest";
import {
  analyzeWebsiteForStep,
  WEBSITE_ANALYSIS_FAILED_MESSAGE,
} from "@/lib/onboarding/website-step-flow";

describe("analyzeWebsiteForStep", () => {
  it("returns ok on successful analysis", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi.fn(async () => ({ ok: true as const }));

    const result = await analyzeWebsiteForStep("https://example.com", {
      analyze,
      setAnalyzing,
    });

    expect(result.ok).toBe(true);
    expect(setAnalyzing).toHaveBeenCalledWith(true);
    expect(setAnalyzing).toHaveBeenCalledWith(false);
  });

  it("returns error on analysis failure", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi.fn(async () => ({
      ok: false as const,
      error: "Invalid URL",
    }));

    const result = await analyzeWebsiteForStep("bad-url", {
      analyze,
      setAnalyzing,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid URL");
    }
    expect(setAnalyzing).toHaveBeenCalledWith(false);
  });

  it("catches thrown exceptions and returns user-safe error", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi.fn(async () => {
      throw new Error("Network timeout");
    });

    const result = await analyzeWebsiteForStep("https://example.com", {
      analyze,
      setAnalyzing,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(WEBSITE_ANALYSIS_FAILED_MESSAGE);
    }
    expect(setAnalyzing).toHaveBeenCalledWith(false);
  });

  it("always calls setAnalyzing(false) even on throw", async () => {
    const setAnalyzing = vi.fn();
    const analyze = vi.fn(async () => {
      throw new Error("crash");
    });

    await analyzeWebsiteForStep("https://example.com", {
      analyze,
      setAnalyzing,
    });

    const calls = setAnalyzing.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe(true);
    expect(calls[calls.length - 1]).toBe(false);
  });
});
