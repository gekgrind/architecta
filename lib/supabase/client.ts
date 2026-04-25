// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

import { getSharedSupabaseCookieOptions } from "@/lib/supabase/cookies";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSharedSupabaseCookieOptions(),
    }
  );
}
