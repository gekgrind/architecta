"use server";

import { anthropic } from "@/lib/ai/providers/anthropic";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canUseClaude } from "@/lib/auth/entitlements";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";

function extractClaudeText(content: ContentBlock[]) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function generateWithClaude(prompt: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  // Fetch plan
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  if (!canUseClaude(profile?.plan)) {
    return {
      ok: false,
      upgradeRequired: true,
      error: "Claude is available on Pro plans",
    };
  }

  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = extractClaudeText(msg.content);

  return { ok: true, text };
}
