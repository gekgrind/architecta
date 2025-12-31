"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateWithClaude } from "@/lib/ai/actions/anthropic";

export async function getOnboardingSuggestions({
  step,
  context,
}: {
  step: string;
  context: Record<string, any>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
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
`;

  const result = await generateWithClaude(prompt);

  return {
    ok: true,
    suggestions: result.text ?? "",
  };
}
