"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setClaudePreference(preferClaude: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("brand_profiles")
    .update({
      ai_preferences: { preferClaude },
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
