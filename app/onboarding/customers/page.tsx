import { redirect } from "next/navigation";
import CustomersStep from "@/components/onboarding/CustomersStep";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

export default async function CustomersPage() {
  const { profile, session } = await getOrCreateArchitectaOnboarding();

  // Prevent skipping ahead
  if (session.current_step && session.current_step !== "customers") {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <CustomersStep
      initialProfile={profile}
      initialSession={session}
    />
  );
}
