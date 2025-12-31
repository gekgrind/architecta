export type OnboardingStepId =
  | "welcome"
  | "source"
  | "website"
  | "snapshot"
  | "market"
  | "customers"
  | "foundation"
  | "voice"
  | "visuals"
  | "review"
  | "finish";

export const ONBOARDING_STEPS: { id: OnboardingStepId; title: string }[] = [
  { id: "welcome", title: "Welcome" },
  { id: "source", title: "Start point" },
  { id: "website", title: "Website" },
  { id: "snapshot", title: "Brand snapshot" },
  { id: "market", title: "Market & positioning" },
  { id: "customers", title: "Customer intelligence" },
  { id: "foundation", title: "Brand foundation" },
  { id: "voice", title: "Voice & messaging" },
  { id: "visuals", title: "Visual identity" },
  { id: "review", title: "Review" },
  { id: "finish", title: "Generate" },
];
