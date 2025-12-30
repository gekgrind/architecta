import type { LlmGenerateInput, LlmResult } from "../types";
import { estimateCostUSD } from "./cost";

// Stub: replace with Supabase insert later
export async function logLlmCall(args: {
  input: LlmGenerateInput;
  result: LlmResult;
  routeReason: string;
}) {
  const cost = estimateCostUSD({
    provider: args.result.provider,
    model: args.result.model,
    inputTokens: args.result.usage.inputTokens,
    outputTokens: args.result.usage.outputTokens,
  });

  // For now: console log. In prod: write to `architecta_llm_usage`.
  console.log("[LLM]", {
    workspaceId: args.input.workspaceId,
    task: args.input.task,
    tier: args.input.tier ?? "standard",
    provider: args.result.provider,
    model: args.result.model,
    tokens: args.result.usage.totalTokens,
    cost,
    fallback: args.result.usedFallback ?? false,
    latencyMs: args.result.latencyMs,
    meta: args.input.metadata ?? {},
    routeReason: args.routeReason,
  });
}
