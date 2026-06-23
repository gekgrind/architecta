import OpenAI from "openai";
import { aggregateMemory } from "@/lib/ai/memoryAggregator";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type LearnRequestBody = {
  workspaceId?: string | null;
};

type AggregatedMemoryItem = {
  summary?: string | null;
  text?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return apiError("unauthorized", "Unauthorized");

    const body = await parseJsonBody<LearnRequestBody>(req);
    const workspaceId = body?.workspaceId ?? null;

    const { data: memoryEvents, error: memoryError } = await supabase
      .from("memory_events")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("workspace_id", workspaceId);

    if (memoryError) return apiError("server_error", memoryError.message);

    const aggregated = aggregateMemory(
      (memoryEvents ?? []) as Parameters<typeof aggregateMemory>[0]
    ) as AggregatedMemoryItem[];

    if (aggregated.length === 0) {
      return apiOk({ skipped: true, updated: false });
    }

    const { data: existing, error: existingError } = await supabase
      .from("founder_style_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) return apiError("server_error", existingError.message);

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const prompt = `
You maintain a Founder Style Profile.
It must be human-readable and practical.

EXISTING PROFILE:
${existing?.profile_text ?? "None yet."}

NEW MEMORY SIGNALS:
${aggregated.map((item) => item.summary ?? item.text ?? "").join("\n")}

Rules:
- Update only with strong evidence
- Avoid repetition
- Plain English
- Short and clear

Return ONLY the updated profile text.
`.trim();

    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: prompt }],
    });

    const updatedProfile =
      res.choices[0]?.message?.content?.trim() ?? existing?.profile_text;

    const updated = Boolean(updatedProfile && updatedProfile !== existing?.profile_text);

    if (updated) {
      const { error } = await supabase.from("founder_style_profiles").insert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        profile_text: updatedProfile,
        version: (existing?.version ?? 0) + 1,
        confidence_score: Math.min(
          1,
          (existing?.confidence_score ?? 0.5) + 0.05
        ),
      });

      if (error) return apiError("server_error", error.message);
    }

    return apiOk({ skipped: false, updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Learn failed";
    return apiError("server_error", message);
  }
}
