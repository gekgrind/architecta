"use server";

import { headers } from "next/headers";
import { runGateway } from "@/lib/ai/llm/run";
import { aiUsageDeniedMessage, checkAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOnboardingSuggestions({
  step,
  context,
}: {
  step: string;
  context: Record<string, unknown>;
}) {
  if (process.env.NODE_ENV === "development") {
    const referer = (await headers()).get("referer") ?? "";
    if (referer.includes("/onboarding/preview")) {
      return {
        ok: true as const,
        suggestions:
          "Focus on the specific transformation your customers experience.\nUse concrete outcomes over abstract benefits.\nSpeak directly to the founder identity — they want to feel seen, not sold to.",
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const allowance = await checkAiUsage(user.id, RATE_LIMITS.onboardingSuggest);
  if (!allowance.allowed) {
    return { ok: false as const, error: aiUsageDeniedMessage(allowance) };
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
