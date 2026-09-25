import { notFound } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import PreviewShell from "@/components/onboarding/preview/PreviewShell";

type Props = {
  searchParams: Promise<{ step?: string }>;
};

export default async function OnboardingPreviewPage({ searchParams }: Props) {
  // Defence-in-depth: layout already blocks, but guard here too.
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { step } = await searchParams;
  const stepId = ONBOARDING_STEPS.find((s) => s.id === step)?.id ?? "welcome";

  return <PreviewShell initialStep={stepId} />;
}
