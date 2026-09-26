import type { SupabaseClient } from "@supabase/supabase-js";

import { APP_HOME_PATH, ONBOARDING_PATH } from "@/lib/auth/redirects";
import { ONBOARDING_STEPS, getStepIndex, type OnboardingStepId } from "./steps";

/**
 * The single definition of "Architecta onboarding complete".
 *
 * Architecta's own `onboarding_sessions` row (app = 'architecta') is the
 * source of truth. The shared `profiles.onboarding_complete` flag belongs to
 * Entrepreneuria onboarding and must never be used to skip Architecta's flow.
 *
 * This module is intentionally free of `server-only` / `next/headers` imports
 * so the middleware (edge runtime) and server code share the same predicate.
 */

export const ARCHITECTA_ONBOARDING_APP = "architecta";

export const ONBOARDING_SESSION_STATUS = {
  inProgress: "in_progress",
  completed: "completed",
} as const;

type OnboardingSessionState = {
  status?: string | null;
  current_step?: string | null;
  completed_steps?: string[] | null;
};

export function isArchitectaOnboardingComplete(
  session: Pick<OnboardingSessionState, "status"> | null | undefined
): boolean {
  return session?.status === ONBOARDING_SESSION_STATUS.completed;
}

/**
 * Looks up the signed-in user's Architecta onboarding session and reports
 * whether it is completed. Fails closed (not complete) on a read error, the
 * same way the previous profile-flag gate did.
 */
export async function fetchArchitectaOnboardingComplete(
  supabase: Pick<SupabaseClient, "from">,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("onboarding_sessions")
    .select("status")
    .eq("user_id", userId)
    .eq("app", ARCHITECTA_ONBOARDING_APP)
    .maybeSingle();

  if (error) return false;

  return isArchitectaOnboardingComplete(data);
}

export type OnboardingStepAccess =
  | { kind: "render" }
  | { kind: "redirect"; to: string };

/**
 * Decides whether `/onboarding/[step]` may render the requested step.
 *
 * - completed onboarding → dashboard
 * - the furthest reached step, or any earlier step → render
 * - a step beyond the furthest reached step → redirect to the furthest step
 */
export function resolveOnboardingStepAccess(
  requestedStep: OnboardingStepId,
  session: OnboardingSessionState | null | undefined
): OnboardingStepAccess {
  if (isArchitectaOnboardingComplete(session)) {
    return { kind: "redirect", to: APP_HOME_PATH };
  }

  const reachedIndexes = [
    getStepIndex(session?.current_step),
    ...(Array.isArray(session?.completed_steps)
      ? session.completed_steps.map((s) => getStepIndex(s))
      : []),
  ];
  const furthestIndex = Math.max(0, ...reachedIndexes);

  if (getStepIndex(requestedStep) <= furthestIndex) {
    return { kind: "render" };
  }

  return {
    kind: "redirect",
    to: `${ONBOARDING_PATH}/${ONBOARDING_STEPS[furthestIndex].id}`,
  };
}
