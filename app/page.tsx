import { redirect } from "next/navigation";

import {
  APP_HOME_PATH,
  ONBOARDING_PATH,
  buildSharedLoginHref,
} from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildSharedLoginHref(APP_HOME_PATH));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.onboarding_complete ? APP_HOME_PATH : ONBOARDING_PATH);
}
