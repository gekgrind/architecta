import type { OnboardingStep } from "@/lib/onboarding/types";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

import WelcomeStep from "./WelcomeStep";
import SourceStep from "@/components/onboarding/SourceStep";
import WebsiteStep from "@/components/onboarding/WebsiteStep";
import SnapshotStep from "@/components/onboarding/SnapshotStep";
import MarketStep from "@/components/onboarding/MarketStep";
import CustomersStep from "@/components/onboarding/CustomersStep";
import FoundationStep from "@/components/onboarding/FoundationStep";
import VoiceStep from "@/components/onboarding/VoiceStep";
import VisualsStep from "@/components/onboarding/VisualsStep";
import ReviewStep from "@/components/onboarding/ReviewStep";
import FinishStep from "./FinishStep";

export type OnboardingContext = {
  answers: OnboardingAnswers;
  sessionId: string;
  hasExistingContext: boolean;
  websiteUrl: string | null;
};

type Props = {
  step: OnboardingStep;
  context: OnboardingContext;
};

export default function StepRenderer({ step, context }: Props) {
  switch (step.type) {
    case "welcome":
      return <WelcomeStep />;
    case "source":
      return <SourceStep />;
    case "website":
      return (
        <WebsiteStep
          answers={context.answers}
          hasExistingContext={context.hasExistingContext}
          existingWebsiteUrl={context.websiteUrl}
          sessionId={context.sessionId}
        />
      );
    case "snapshot":
      return (
        <SnapshotStep
          answers={context.answers}
          sessionId={context.sessionId}
          hasExistingContext={context.hasExistingContext}
        />
      );
    case "market":
      return (
        <MarketStep
          answers={context.answers}
          sessionId={context.sessionId}
        />
      );
    case "customers":
      return (
        <CustomersStep
          answers={context.answers}
          sessionId={context.sessionId}
        />
      );
    case "foundation":
      return (
        <FoundationStep
          answers={context.answers}
          sessionId={context.sessionId}
        />
      );
    case "voice":
      return (
        <VoiceStep
          answers={context.answers}
          sessionId={context.sessionId}
        />
      );
    case "visuals":
      return (
        <VisualsStep
          answers={context.answers}
          sessionId={context.sessionId}
        />
      );
    case "review":
      return (
        <ReviewStep
          answers={context.answers}
          sessionId={context.sessionId}
          hasExistingContext={context.hasExistingContext}
        />
      );
    case "finish":
      return <FinishStep />;
    default:
      return null;
  }
}
