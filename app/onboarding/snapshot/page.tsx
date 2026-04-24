import { redirect } from "next/navigation";
import SnapshotStep from "@/components/onboarding/SnapshotStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function SnapshotPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead or landing on wrong step
  if (session.current_step && session.current_step !== "snapshot") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <SnapshotStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
