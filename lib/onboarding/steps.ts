import type { OnboardingStep } from "./types";

export function getPreviousStepUrl(currentStepId: string): string | null {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId);
  if (idx <= 0) return null;
  return `/onboarding/${ONBOARDING_STEPS[idx - 1].id}`;
}

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

/**
 * Architecta Blueprint Onboarding Steps
 *
 * These steps are:
 * - Route-addressable (/onboarding/[step])
 * - Server-persisted
 * - UI-driven by the Blueprint onboarding system
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    number: "00",
    label: "Welcome",
    title: "Welcome to Architecta",
    subtitle: "Let’s build your brand system",
    type: "welcome",
  },

  {
    id: "source",
    number: "01",
    label: "Starting point",
    title: "Where are you starting from?",
    subtitle: "This helps Architecta tailor your setup",
    type: "source",
  },

  {
    id: "website",
    number: "02",
    label: "Website",
    title: "Connect your website",
    subtitle: "If you connect your site, Architecta can auto-build most of your Brand Kit.",
    type: "website",
  },

  {
    id: "snapshot",
    number: "03",
    label: "Brand snapshot",
    title: "Your brand at a glance",
    subtitle: "This is the foundation Architecta builds everything on.",
    type: "snapshot",
  },

  {
    id: "market",
    number: "04",
    label: "Market & positioning",
    title: "Where you compete and how you win",
    subtitle: "This helps Architecta avoid generic content.",
    type: "market",
  },

  {
    id: "customers",
    number: "05",
    label: "Customer intelligence",
    title: "Who are you creating for?",
    subtitle: "Clear customer insight makes content convert.",
    type: "customers",
  },

  {
    id: "foundation",
    number: "06",
    label: "Brand foundation",
    title: "What your brand stands for",
    subtitle: "These guide every message Architecta creates.",
    type: "foundation",
  },

  {
    id: "voice",
    number: "07",
    label: "Voice & messaging",
    title: "How your brand sounds in the world",
    subtitle: "This defines how Architecta speaks on your behalf.",
    type: "voice",
  },

  {
    id: "visuals",
    number: "08",
    label: "Visual identity",
    title: "How your brand should look",
    subtitle: "This helps Architecta format content to match your brand.",
    type: "visuals",
  },

  {
    id: "review",
    number: "09",
    label: "Review",
    title: "Confirm Architecta’s understanding",
    subtitle: "Architecta will generate your content system from this.",
    type: "review",
  },

  {
    id: "finish",
    number: "10",
    label: "Generate brand system",
    title: "Architecta builds your Brand Kit",
    type: "finish",
  },
];
