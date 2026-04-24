// app/onboarding/init/page.tsx
import { redirect } from "next/navigation";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function OnboardingInit() {
  const { session } = await getOrCreateArchitectaOnboarding();

  const step = session.current_step ?? "welcome";

  redirect(`/onboarding/${step}`);
}
