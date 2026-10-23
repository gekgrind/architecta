import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { getSupabaseProjectConfig } from "@/lib/config/ecosystem";
import {
  getSharedSupabaseCookieOptions,
  mergeSharedSupabaseCookieOptions,
} from "@/lib/supabase/cookies";

type ServerClientOptions = {
  /**
   * Receives the anti-cache headers @supabase/ssr passes with every auth
   * cookie write. `next/headers` cannot set response headers, so a route
   * handler whose client may refresh a session copies them onto its own
   * response.
   */
  onAuthResponseHeaders?: (headers: Record<string, string>) => void;
};

export async function createSupabaseServerClient({
  onAuthResponseHeaders,
}: ServerClientOptions = {}) {
  /* Throws when Supabase is not configured: no client is ever built from
     undefined credentials. */
  const { url, anonKey } = getSupabaseProjectConfig();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sharedCookieOptions = getSharedSupabaseCookieOptions(
    headerStore.get("host")
  );

  return createServerClient(url, anonKey, {
    cookieOptions: sharedCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        onAuthResponseHeaders?.(headersToSet);

        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(
              name,
              value,
              mergeSharedSupabaseCookieOptions(sharedCookieOptions, options)
            );
          });
        } catch {
          // Route handlers still update cookies correctly; Server Components may not.
        }
      },
    },
  });
}
