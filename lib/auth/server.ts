import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchitectaSessionUser } from "@/lib/domain";

export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<ArchitectaSessionUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return {
    user: {
      id: user.id,
      email: user.email ?? undefined,
    },
  };
}
