import { redirect } from "next/navigation";

import {
  APP_HOME_PATH,
  ONBOARDING_PATH,
  buildSharedLoginHref,
} from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArchitectaOnboardingStatus } from "@/lib/onboarding/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildSharedLoginHref(APP_HOME_PATH));
  }

  const onboarding = await getArchitectaOnboardingStatus();
  redirect(onboarding.onboardingComplete ? APP_HOME_PATH : ONBOARDING_PATH);
}
