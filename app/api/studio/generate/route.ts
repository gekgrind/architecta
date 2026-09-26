import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getMemoryForGeneration } from "@/lib/ai/getMemoryForGeneration";
import { runGateway } from "@/lib/ai/llm/run";
import type { GenerationRequest, GenerationResult } from "@/lib/domain";
import { enforceAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return apiError("unauthorized", "Unauthorized");

    const limited = await enforceAiUsage(session.user.id, RATE_LIMITS.studioGenerate);
    if (limited) return limited;

    const body = await parseJsonBody<GenerationRequest>(req);
    const gen = body?.gen;

    if (!gen?.platform || !gen.idea) {
      return apiError("validation_error", "Missing generation request");
    }

    const workspaceId = body?.workspaceId ?? null;

    const { data: founderProfile, error: founderError } = await supabase
      .from("founder_style_profiles")
      .select("profile_text")
      .eq("user_id", session.user.id)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (founderError) return apiError("server_error", founderError.message);

    const memory = await getMemoryForGeneration({
      userId: session.user.id,
      workspaceId,
      mode: "generate",
      platform: gen.platform,
      idea: gen.idea,
    });

    const systemPrompt = `
You are Architecta - an AI content architect for founders.

PRIORITY ORDER:
1. User request
2. Brand Kit
3. Founder Style Profile
4. Memory signals

FOUNDER STYLE PROFILE:
${founderProfile?.profile_text ?? "Not established yet."}

MEMORY SIGNALS:
${memory.summary}

BRAND KIT:
${JSON.stringify(body?.brand ?? {}, null, 2)}

GENERATION REQUEST:
${JSON.stringify(gen, null, 2)}

Rules:
- Do not mention memory or profiles
- Match founder tone
- Be concise and practical
- Output only the requested content
`.trim();

    // Provider, model and token cap are chosen server-side by the gateway.
    const completion = await runGateway({
      userId: session.user.id,
      workspaceId,
      task: "POST_GENERATION",
      tier: "draft",
      systemPrompt,
      prompt: "Generate the content now.",
      temperature: 0.7,
      metadata: { source: "studio_generate", platform: gen.platform },
    });

    const result: GenerationResult = {
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      createdAt: new Date().toISOString(),
    };

    return apiOk({ generation: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generate failed";
    return apiError("server_error", message);
  }
}
