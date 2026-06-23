import OpenAI from "openai";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getMemoryForGeneration } from "@/lib/ai/getMemoryForGeneration";
import type { GenerationRequest, GenerationResult } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return apiError("unauthorized", "Unauthorized");

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

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const model = "gpt-4.1-mini";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the content now." },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const result: GenerationResult = {
      text,
      provider: "openai",
      model,
      createdAt: new Date().toISOString(),
    };

    return apiOk({ generation: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generate failed";
    return apiError("server_error", message);
  }
}
