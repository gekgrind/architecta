import { NextResponse } from "next/server";
import { createOpenAiClient } from "@/lib/ai/llm/providers/openai";
import { createAnthropicClient } from "@/lib/ai/llm/providers/anthropic";
import { createLlmGateway } from "@/lib/ai/llm/gateway";
import { withSystem, buildSystemPrompt } from "@/lib/ai/llm/prompts";
import type { LlmGenerateInput } from "@/lib/ai/llm/types";

// TODO: Replace with your Supabase server client lookup
async function getWorkspacePreference(workspaceId: string) {
  void workspaceId;

  // Example default:
  return { preference: "auto" as const };
}

const gateway = createLlmGateway({
  openai: createOpenAiClient(),
  anthropic: createAnthropicClient(),
  getWorkspacePreference,
});

export async function POST(req: Request) {
  const body = (await req.json()) as LlmGenerateInput;

  const messages = withSystem(body.messages, buildSystemPrompt(body.task));

  const result = await gateway.generate({
    ...body,
    messages,
  });

  return NextResponse.json({
    text: result.text,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    usedFallback: result.usedFallback ?? false,
    latencyMs: result.latencyMs,
  });
}
