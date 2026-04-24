import { createLlmGateway } from "@/lib/ai/llm/gateway";
import { withSystem, buildSystemPrompt } from "@/lib/ai/llm/prompts";
import { createAnthropicClient } from "@/lib/ai/llm/providers/anthropic";
import { createOpenAiClient } from "@/lib/ai/llm/providers/openai";
import { getWorkspaceLlmPreference } from "@/lib/ai/llm/workspacePrefs";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import type { LlmGenerateInput } from "@/lib/domain";

const gateway = createLlmGateway({
  openai: createOpenAiClient(),
  anthropic: createAnthropicClient(),
  getWorkspacePreference: getWorkspaceLlmPreference,
});

export async function POST(req: Request) {
  const body = await parseJsonBody<LlmGenerateInput>(req);

  if (!body?.workspaceId || !body.task || !Array.isArray(body.messages)) {
    return apiError("validation_error", "Invalid LLM generation request");
  }

  try {
    const messages = withSystem(body.messages, buildSystemPrompt(body.task));
    const result = await gateway.generate({
      ...body,
      messages,
    });

    return apiOk({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "LLM generation failed";
    return apiError("upstream_error", message);
  }
}
