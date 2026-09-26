import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ARCHITECTA_ONBOARDING_APP,
  ONBOARDING_SESSION_STATUS,
  isArchitectaOnboardingComplete,
} from "./gate";
import { getFurthestStep, type OnboardingStepId } from "./steps";

export type ArchitectaOnboardingStatus = {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  /** Derived from the Architecta onboarding session — never profiles.onboarding_complete. */
  onboardingComplete: boolean;
  answers: Record<string, unknown>;
};

/**
 * Ensures the shared profiles row exists so shared business facts can be
 * backfilled later. Never reads or writes the shared (Entrepreneuria)
 * onboarding flags.
 */
async function ensureSharedProfileRow(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (existing) return;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId });

  if (insertError) throw insertError;
}

/**
 * Canonical initializer for Architecta onboarding
 * - Ensures ONE onboarding_sessions row
 * - Ensures ONE brand_profiles row
 * - NEVER returns nulls
 * - NEVER relies on client timing
 */
export async function getOrCreateArchitectaOnboarding() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  /* =====================================================
     ONBOARDING SESSION (single source of truth for flow)
  ====================================================== */

  const { data: existingSession, error: sessionError } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", ARCHITECTA_ONBOARDING_APP)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  let session = existingSession;

  if (!session) {
    const { data: inserted, error: insertError } = await supabase
      .from("onboarding_sessions")
      .insert({
        user_id: user.id,
        app: ARCHITECTA_ONBOARDING_APP,
        current_step: "welcome",
        completed_steps: [],
        flags: {},
        answers: {},
        status: ONBOARDING_SESSION_STATUS.inProgress,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    session = inserted;
  }

  /* =====================================================
     BRAND PROFILE (dependent but required)
  ====================================================== */

  const { data: existingProfile, error: profileError } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  let profile = existingProfile;

  if (!profile) {
    const { data: inserted, error: insertError } = await supabase
      .from("brand_profiles")
      .insert({
        user_id: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    profile = inserted;
  }

  await ensureSharedProfileRow(user.id);

  return { user, session, profile };
}

export async function getArchitectaOnboardingStatus(): Promise<ArchitectaOnboardingStatus> {
  const { session } = await getOrCreateArchitectaOnboarding();

  return {
    currentStep: session.current_step ?? "welcome",
    completedSteps: Array.isArray(session.completed_steps) ? session.completed_steps : [],
    onboardingComplete: isArchitectaOnboardingComplete(session),
    answers:
      session.answers && typeof session.answers === "object" && !Array.isArray(session.answers)
        ? session.answers
        : {},
  };
}

/**
 * Advance onboarding step
 * - Guarantees session exists
 * - Appends to completed_steps safely
 * - Never moves current_step backwards (it records the furthest step reached)
 */
export async function updateOnboardingStep(
  step: OnboardingStepId,
  markCompleted?: boolean
) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  const { data: session, error: sessionError } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", ARCHITECTA_ONBOARDING_APP)
    .single();

  if (sessionError || !session) {
    throw sessionError ?? new Error("Onboarding session missing");
  }

  const completedSteps: OnboardingStepId[] = Array.isArray(
    session.completed_steps
  )
    ? session.completed_steps
    : [];

  const nextCompleted =
    markCompleted && !completedSteps.includes(step)
      ? [...completedSteps, step]
      : completedSteps;

  const { error: updateError } = await supabase
    .from("onboarding_sessions")
    .update({
      current_step: getFurthestStep(session.current_step, step),
      completed_steps: nextCompleted,
    })
    .eq("id", session.id);

  if (updateError) {
    throw updateError;
  }
}

/**
 * Update arbitrary onboarding flags
 * - Stored on onboarding_sessions.flags
 * - Never overwrites existing flags
 */
export async function setOnboardingFlag(flagKey: string, value: unknown) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  const { data: session, error: sessionError } = await supabase
    .from("onboarding_sessions")
    .select("id, flags")
    .eq("user_id", user.id)
    .eq("app", "architecta")
    .single();

  if (sessionError || !session) {
    throw sessionError ?? new Error("Onboarding session missing");
  }

  const nextFlags = {
    ...(session.flags ?? {}),
    [flagKey]: value,
  };

  const { error: updateError } = await supabase
    .from("onboarding_sessions")
    .update({ flags: nextFlags })
    .eq("id", session.id);

  if (updateError) {
    throw updateError;
  }
}

