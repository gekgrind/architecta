import { redirect } from "next/navigation";
import ReviewStep from "@/components/onboarding/ReviewStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function ReviewPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "review") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <ReviewStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
