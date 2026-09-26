import { runGateway } from "@/lib/ai/llm/run";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { StudioRefineRequest, StudioRefineResult } from "@/lib/domain";
import { enforceAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<StudioRefineRequest>(req);

    if (!body?.platform || !body.draft || !body.revision) {
      return apiError("validation_error", "Missing refine payload");
    }

    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return apiError("unauthorized", "Unauthorized");

    const limited = await enforceAiUsage(session.user.id, RATE_LIMITS.studioRefine);
    if (limited) return limited;

    const instructions: string[] = [];

    if (body.revision.tone === "clearer") {
      instructions.push("Make the tone clearer and more direct.");
    }
    if (body.revision.tone === "bolder") {
      instructions.push("Make the tone bolder and more confident.");
    }
    if (body.revision.length === "shorter") {
      instructions.push("Make the content more concise.");
    }
    if (body.revision.length === "longer") {
      instructions.push("Expand the content slightly.");
    }
    if (body.revision.ctaStrength === "stronger") {
      instructions.push("Strengthen the call to action.");
    }
    if (body.revision.ctaStrength === "subtle") {
      instructions.push("Soften the call to action.");
    }

    const systemPrompt = `
You are a professional marketing writer.
Preserve the original intent.
Do not introduce new ideas.
Apply only the requested refinements.
`.trim();

    const userPrompt = `
Platform: ${body.platform}
Brand: ${body.brand?.brandName ?? "Unknown"}

Original draft:
"""
${body.draft}
"""

Refinement instructions:
- ${instructions.join("\n- ")}
`.trim();

    // Provider, model and token cap are chosen server-side by the gateway.
    const completion = await runGateway({
      userId: session.user.id,
      task: "POST_REVISION",
      tier: "draft",
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.4,
      metadata: { source: "studio_refine" },
    });

    const text = completion.text.trim();
    if (!text) return apiError("upstream_error", "No refined output returned");

    const memorySignals: {
      signal_type: string;
      signal_value: string;
      confidence: number;
      source: string;
    }[] = [];

    if (body.revision.length && body.revision.length !== "same") {
      memorySignals.push({
        signal_type: "length",
        signal_value: body.revision.length,
        confidence: 0.15,
        source: "architecta",
      });
    }
    if (body.revision.tone && body.revision.tone !== "same") {
      memorySignals.push({
        signal_type: "tone",
        signal_value: body.revision.tone,
        confidence: 0.15,
        source: "architecta",
      });
    }
    if (body.revision.ctaStrength && body.revision.ctaStrength !== "same") {
      memorySignals.push({
        signal_type: "cta",
        signal_value: body.revision.ctaStrength,
        confidence: 0.1,
        source: "architecta",
      });
    }

    if (memorySignals.length > 0) {
      const { error: memError } = await supabase
        .from("ai_edit_memory")
        .insert(memorySignals.map((signal) => ({ ...signal, user_id: session.user.id })));

      if (memError) console.warn("AI memory insert warning:", memError);
    }

    const result: StudioRefineResult = {
      text,
      createdAt: new Date().toISOString(),
    };

    return apiOk({ refinement: result });
  } catch (err: unknown) {
    console.error("Studio refine route error:", err);
    return apiError("server_error", "Server error");
  }
}
