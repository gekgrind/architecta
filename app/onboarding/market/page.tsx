import { redirect } from "next/navigation";
import MarketStep from "@/components/onboarding/MarketStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function MarketPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "market") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <MarketStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
