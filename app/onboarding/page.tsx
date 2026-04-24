import { redirect } from "next/navigation";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

/**
 * Architecta Onboarding Entry Point
 *
 * This route is responsible for:
 * - Creating or resuming an onboarding session
 * - Determining the current onboarding step
 * - Redirecting to the correct step route
 *
 * UI rendering is handled in /onboarding/[step]/page.tsx
 * (Blueprint onboarding lives there, layered over Prism)
 */
export default async function OnboardingIndex() {
  const { session } = await getOrCreateArchitectaOnboarding();

  /**
   * Fallback logic:
   * If for any reason the session does not yet have a step,
   * we start at the blueprint "welcome" step.
   */
  const step = session?.current_step ?? "welcome";

  /**
   * Redirect to step-based onboarding route
   * Example:
   *  /onboarding/welcome
   *  /onboarding/website
   *  /onboarding/brand-snapshot
   */
  redirect(`/onboarding/${step}`);
}
