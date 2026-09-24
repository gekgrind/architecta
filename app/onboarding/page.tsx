import { redirect } from "next/navigation";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function OnboardingIndex() {
  const { session } = await getOrCreateArchitectaOnboarding();

  const step = session?.current_step ?? "welcome";

  redirect(`/onboarding/${step}`);
}
