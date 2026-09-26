import { notFound, redirect } from "next/navigation";
import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/onboarding/steps";
import BlueprintOnboarding from "@/components/onboarding/BlueprintOnboarding";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";
import { loadOnboardingContext } from "@/lib/onboarding/actions";
import { resolveOnboardingStepAccess } from "@/lib/onboarding/gate";

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

  // Earlier and current steps render (answers are preserved in the session);
  // only jumping ahead of the furthest reached step is redirected.
  const access = resolveOnboardingStepAccess(step as OnboardingStepId, session);

  if (access.kind === "redirect") {
    redirect(access.to);
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
