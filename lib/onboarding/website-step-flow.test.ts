import { describe, expect, it, vi } from "vitest";

import {
  analyzeWebsiteForStep,
  WEBSITE_ANALYSIS_FAILED_MESSAGE,
} from "./website-step-flow";

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
