import { runGateway } from "@/lib/ai/llm/run";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LlmGenerateInput } from "@/lib/domain";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<LlmGenerateInput>(req);

  if (!body?.task || !Array.isArray(body.messages) || body.messages.length === 0) {
    return apiError("validation_error", "Invalid LLM generation request");
  }

  try {
    const result = await runGateway({
      userId: session.user.id,
      workspaceId: body.workspaceId ?? null,
      task: body.task,
      tier: body.tier,
      messages: body.messages,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      preference: body.preference,
      metadata: body.metadata,
    });

    return apiOk({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "LLM generation failed";
    return apiError("upstream_error", message);
  }
}
