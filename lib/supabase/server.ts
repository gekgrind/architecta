import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEcosystemCookieDomain } from "@/lib/config/ecosystem";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const sharedCookieDomain = getEcosystemCookieDomain();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...(sharedCookieDomain ? { domain: sharedCookieDomain } : {}),
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
