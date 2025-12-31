import { redirect } from "next/navigation";
import VisualsStep from "@/components/onboarding/VisualsStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function VisualsPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "visuals") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <VisualsStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
