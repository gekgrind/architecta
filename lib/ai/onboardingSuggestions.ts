"use server";

import { runGateway } from "@/lib/ai/llm/run";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOnboardingSuggestions({
  step,
  context,
}: {
  step: string;
  context: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const prompt = `
You are helping a user complete onboarding for an AI content system.

Step: ${step}

Known context:
${JSON.stringify(context, null, 2)}

Return helpful, concise suggestions only.
No explanations.
No markdown.
No emojis.
`.trim();

  try {
    const result = await runGateway({
      userId: user.id,
      task: "ONBOARDING_SUGGESTION",
      tier: "draft",
      prompt,
    });

    return { ok: true as const, suggestions: result.text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suggestion failed";
    return { ok: false as const, error: message };
  }
}
