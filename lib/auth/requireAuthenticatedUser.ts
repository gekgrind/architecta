import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { buildSharedLoginHref } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthenticatedServerUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function requireAuthenticatedUser(nextPath?: string): Promise<User> {
  const user = await getAuthenticatedServerUser();

  if (!user) {
    redirect(buildSharedLoginHref(nextPath));
  }

  return user;
}
