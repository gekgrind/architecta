import { OnboardingStep } from "@/lib/onboarding/types";

import WelcomeStep from "./WelcomeStep";
import SourceStep from "./WelcomeStep";
import WebsiteStep from "./WebsiteStep";
import SnapshotStep from "./SnapshotStep";
import MarketStep from "./MarketStep";
import CustomersStep from "./CustomersStep";
import FoundationStep from "./FoundationStep";
import VoiceStep from "./VoiceStep";
import VisualsStep from "./VisualsStep";
import ReviewStep from "./ReviewStep";
import FinishStep from "./FinishStep";

export default function StepRenderer({ step }: { step: OnboardingStep }) {
  switch (step.type) {
    case "welcome":
      return <WelcomeStep />;
    case "source":
      return <SourceStep />;
    case "website":
      return <WebsiteStep />;
    case "snapshot":
      return <SnapshotStep />;
    case "market":
      return <MarketStep />;
    case "customers":
      return <CustomersStep />;
    case "foundation":
      return <FoundationStep />;
    case "voice":
      return <VoiceStep />;
    case "visuals":
      return <VisualsStep />;
    case "review":
      return <ReviewStep />;
    case "finish":
      return <FinishStep />;
    default:
      return null;
  }
}
