import { redirect } from "next/navigation";
import FoundationStep from "@/components/onboarding/FoundationStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function FoundationPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "foundation") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <FoundationStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
