import type { OnboardingStepId } from "./steps";

export type OnboardingStepType =
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
 * Core Blueprint onboarding step definition
 * Used by:
 * - Routing (/onboarding/[step])
 * - Server session persistence
 * - Blueprint UI rendering
 */
export interface OnboardingStep {
  /** Route + persistence ID */
  id: OnboardingStepId;

  /** Blueprint step number (00–10) */
  number: string;

  /** Short semantic step name (shown in the card metadata, e.g. "Starting point") */
  label: string;

  /** Primary question / heading the step asks the user */
  title: string;

  /** Supporting description under the title */
  subtitle?: string;

  /** Used to map to UI components */
  type: OnboardingStepType;

  /** Optional icon key (future-proofing) */
  icon?: string;
}
