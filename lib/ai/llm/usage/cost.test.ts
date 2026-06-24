import { describe, expect, it } from "vitest";

import { estimateCostUSD } from "./cost";

describe("estimateCostUSD", () => {
  it("computes input + output cost for a known OpenAI model", () => {
    // gpt-4o: $2.50/1M in, $10/1M out
    const cost = estimateCostUSD({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(12.5);
  });

  it("computes cost for the default Anthropic model", () => {
    // claude-sonnet-4-6: $3/1M in, $15/1M out
    const cost = estimateCostUSD({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(18);
  });

  it("prices the dated Haiku id the same as the alias", () => {
    const alias = estimateCostUSD({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const dated = estimateCostUSD({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(alias).toBe(6);
    expect(dated).toBe(6);
  });

  it("scales sub-million token counts", () => {
    const cost = estimateCostUSD({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 500_000, // 0.5 * $0.15 = 0.075
      outputTokens: 250_000, // 0.25 * $0.60 = 0.15
    });
    expect(cost).toBeCloseTo(0.225, 5);
  });

  it("returns null for an unpriced model", () => {
    const cost = estimateCostUSD({
      provider: "anthropic",
      model: "claude-some-future-model",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(cost).toBeNull();
  });

  it("returns 0 for zero tokens on a known model", () => {
    const cost = estimateCostUSD({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(cost).toBe(0);
  });
});
