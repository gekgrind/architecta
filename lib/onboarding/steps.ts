import type { OnboardingStep } from "./types";

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
    title: "Welcome to Architecta",
    subtitle: "Lets build your brand system",
    type: "welcome",
  },

  {
    id: "source",
    number: "01",
    title: "Starting point",
    subtitle: "How Architecta should learn about your brand",
    type: "source",
  },

  {
    id: "website",
    number: "02",
    title: "Website",
    subtitle: "Real-world context for voice, positioning, and structure",
    type: "website",
  },

  {
    id: "snapshot",
    number: "03",
    title: "Brand snapshot",
    subtitle: "Your brand at a glance",
    type: "snapshot",
  },

  {
    id: "market",
    number: "04",
    title: "Market & positioning",
    subtitle: "Where you compete and how you win",
    type: "market",
  },

  {
    id: "customers",
    number: "05",
    title: "Customer intelligence",
    subtitle: "Who your brand speaks to emotionally",
    type: "customers",
  },

  {
    id: "foundation",
    number: "06",
    title: "Brand foundation",
    subtitle: "Mission, vision, values, and promise",
    type: "foundation",
  },

  {
    id: "voice",
    number: "07",
    title: "Voice & messaging",
    subtitle: "How your brand sounds in the world",
    type: "voice",
  },

  {
    id: "visuals",
    number: "08",
    title: "Visual identity",
    subtitle: "Logos, inspiration, and aesthetic signals",
    type: "visuals",
  },

  {
    id: "review",
    number: "09",
    title: "Review",
    subtitle: "Confirm Architecta’s understanding",
    type: "review",
  },

  {
    id: "finish",
    number: "10",
    title: "Generate brand system",
    subtitle: "Architecta builds your Brand Kit",
    type: "finish",
  },
];
