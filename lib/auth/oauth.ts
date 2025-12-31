// /lib/auth/oauth.ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type OAuthProvider =
  | "google"
  | "github"
  | "apple"
  | "facebook";

export async function signInWithProvider(provider: OAuthProvider) {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${location.origin}/auth/callback`,
    },
  });
}
