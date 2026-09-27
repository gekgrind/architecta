import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LlmGenerateInput, LlmResult } from "../types";
import { estimateCostUSD } from "./cost";

export async function logLlmCall(args: {
  input: LlmGenerateInput;
  result: LlmResult;
  routeReason: string;
  /** 1-based provider attempt that produced this result (retries/fallbacks count). */
  attempt?: number;
}) {
  const cost = estimateCostUSD({
    provider: args.result.provider,
    model: args.result.model,
    inputTokens: args.result.usage.inputTokens,
    outputTokens: args.result.usage.outputTokens,
  });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { error } = await supabase.from("architecta_llm_usage").insert({
      user_id: user.id,
      workspace_id: args.input.workspaceId === user.id ? null : args.input.workspaceId,
      task: args.input.task,
      tier: args.input.tier ?? "standard",
      provider: args.result.provider,
      model: args.result.model,
      input_tokens: args.result.usage.inputTokens,
      output_tokens: args.result.usage.outputTokens,
      total_tokens: args.result.usage.totalTokens,
      // Column is NOT NULL: unpriced models (e.g. NVIDIA) record 0 and are
      // flagged in meta instead of failing the insert.
      cost_usd: cost ?? 0,
      used_fallback: args.result.usedFallback ?? false,
      latency_ms: args.result.latencyMs ?? null,
      request_id: args.result.requestId ?? null,
      route_reason: args.routeReason,
      meta: {
        ...(args.input.metadata ?? {}),
        attempt: args.attempt ?? 1,
        cost_estimated: cost !== null,
      },
    });

    if (error) {
      console.warn("[llm-usage] insert failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[llm-usage] unable to record call:",
      err instanceof Error ? err.message : err
    );
  }
}
