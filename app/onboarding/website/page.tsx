import { redirect } from "next/navigation";
import WebsiteStep from "@/components/onboarding/WebsiteStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function WebsitePage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Safety: prevent skipping ahead
  if (session.current_step && session.current_step !== "website") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <WebsiteStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
