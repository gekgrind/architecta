import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function signInWithProvider(
  provider: "google" | "github"
) {
  const supabase = createSupabaseBrowserClient();

  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${location.origin}/auth/callback`,
    },
  });
}
