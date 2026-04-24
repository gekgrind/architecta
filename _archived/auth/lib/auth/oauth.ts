// /lib/auth/oauth.ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeAuthRedirectPath } from "@/lib/auth/redirect";

export type OAuthProvider = "google" | "github" | "facebook";

export async function signInWithProvider(
  provider: OAuthProvider,
  nextPath?: string | null
) {
  const supabase = createSupabaseBrowserClient();
  const redirectUrl = new URL("/auth/callback", location.origin);
  const safeNextPath = nextPath
    ? sanitizeAuthRedirectPath(nextPath)
    : null;
  if (safeNextPath) {
    redirectUrl.searchParams.set("next", safeNextPath);
  }

  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl.toString(),
    },
  });
}
