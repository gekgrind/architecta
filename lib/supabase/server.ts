import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSharedSupabaseCookieOptions } from "@/lib/supabase/cookies";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const sharedCookieOptions = getSharedSupabaseCookieOptions();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...sharedCookieOptions,
              });
            });
          } catch {
            // Route handlers still update cookies correctly; Server Components may not.
          }
        },
      },
    }
  );
}
