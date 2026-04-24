import { notFound, redirect } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import BlueprintOnboarding from "@/components/onboarding/BlueprintOnboarding";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

type Props = {
  params: Promise<{
    step: string;
  }>;
};

export default async function OnboardingStepPage({ params }: Props) {
  const { step } = await params;

  // Validate step against known onboarding steps
  const stepExists = ONBOARDING_STEPS.some((s) => s.id === step);

  if (!stepExists) {
    notFound();
  }

  // Ensure onboarding session exists
  const { session } = await getOrCreateArchitectaOnboarding();

  /**
   * If the user somehow navigates to a step
   * that does not match their session state,
   * redirect them to the correct step.
   */
  if (session.current_step && session.current_step !== step) {
    redirect(`/onboarding/${session.current_step}`);
  }

  return (
    <BlueprintOnboarding step={step} />
  );
}
