import { notFound, redirect } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import BlueprintOnboarding from "@/components/onboarding/BlueprintOnboarding";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";
import { loadOnboardingContext } from "@/lib/onboarding/actions";

type Props = {
  params: Promise<{
    step: string;
  }>;
};

export default async function OnboardingStepPage({ params }: Props) {
  const { step } = await params;

  const stepExists = ONBOARDING_STEPS.some((s) => s.id === step);

  if (!stepExists) {
    notFound();
  }

  const { session } = await getOrCreateArchitectaOnboarding();

  if (session.current_step && session.current_step !== step) {
    redirect(`/onboarding/${session.current_step}`);
  }

  const ctx = await loadOnboardingContext();

  return (
    <BlueprintOnboarding
      step={step}
      context={{
        answers: ctx.answers,
        sessionId: ctx.session?.id ?? session.id,
        hasExistingContext: ctx.hasExistingContext,
        websiteUrl: ctx.websiteUrl,
      }}
    />
  );
}
