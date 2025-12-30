import type { LlmProvider } from "../types";

// Keep it simple: you can refine later or pull live pricing.
// Store per-1M token costs (input/output).
type Price = { inPer1M: number; outPer1M: number };

const PRICE_TABLE: Record<string, Price> = {
  // Example placeholders. Set these to your real internal rates.
  "openai:gpt-4o": { inPer1M: 5, outPer1M: 15 },
  "openai:gpt-4o-mini": { inPer1M: 0.5, outPer1M: 2 },

  "anthropic:claude-3-5-sonnet-latest": { inPer1M: 3, outPer1M: 15 },
};

export function estimateCostUSD(args: {
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number | null {
  const key = `${args.provider}:${args.model}`;
  const price = PRICE_TABLE[key];
  if (!price) return null;

  const inCost = (args.inputTokens / 1_000_000) * price.inPer1M;
  const outCost = (args.outputTokens / 1_000_000) * price.outPer1M;
  return Number((inCost + outCost).toFixed(6));
}
