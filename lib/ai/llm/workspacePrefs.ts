import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getWorkspaceLlmPreference(workspaceId: string) {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("llm_preference")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    return { preference: "auto" as const };
  }

  return {
    preference: data.llm_preference as "auto" | "openai" | "anthropic",
  };
}
