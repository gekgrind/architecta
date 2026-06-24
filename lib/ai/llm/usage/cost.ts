import type { LlmProvider } from "../types";

// Keep it simple: you can refine later or pull live pricing.
// Store per-1M token costs (input/output).
type Price = { inPer1M: number; outPer1M: number };

const PRICE_TABLE: Record<string, Price> = {
  // Anthropic — current published per-1M-token rates (input / output).
  "anthropic:claude-fable-5": { inPer1M: 10, outPer1M: 50 },
  "anthropic:claude-opus-4-8": { inPer1M: 5, outPer1M: 25 },
  "anthropic:claude-opus-4-7": { inPer1M: 5, outPer1M: 25 },
  "anthropic:claude-opus-4-6": { inPer1M: 5, outPer1M: 25 },
  "anthropic:claude-sonnet-4-6": { inPer1M: 3, outPer1M: 15 },
  "anthropic:claude-haiku-4-5": { inPer1M: 1, outPer1M: 5 },
  // The settings UI persists the dated Haiku id; price it the same.
  "anthropic:claude-haiku-4-5-20251001": { inPer1M: 1, outPer1M: 5 },

  // OpenAI — public list prices (verify against your billing tier; some
  // accounts have negotiated or batch rates).
  "openai:gpt-4o": { inPer1M: 2.5, outPer1M: 10 },
  "openai:gpt-4o-mini": { inPer1M: 0.15, outPer1M: 0.6 },
  "openai:gpt-4.1": { inPer1M: 2, outPer1M: 8 },
  "openai:gpt-4.1-mini": { inPer1M: 0.4, outPer1M: 1.6 },
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
