import { redirect } from "next/navigation";
import VoiceStep from "@/components/onboarding/VoiceStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function VoicePage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "voice") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <VoiceStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
