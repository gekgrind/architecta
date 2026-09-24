import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingStepId } from "./steps";

export type ArchitectaOnboardingStatus = {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  onboardingComplete: boolean;
  onboardingCompletedAt: string | null;
  answers: Record<string, unknown>;
};

async function getOrCreateProfileOnboardingState(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id, onboarding_complete, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      onboarding_complete: false,
    })
    .select("id, onboarding_complete, onboarding_completed_at")
    .single();

  if (insertError) throw insertError;

  return inserted;
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
    .eq("app", "architecta")
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
        app: "architecta",
        current_step: "welcome",
        completed_steps: [],
        flags: {},
        answers: {},
        status: "in_progress",
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

  await getOrCreateProfileOnboardingState(user.id);

  return { user, session, profile };
}

export async function getArchitectaOnboardingStatus(): Promise<ArchitectaOnboardingStatus> {
  const { user, session } = await getOrCreateArchitectaOnboarding();
  const profileState = await getOrCreateProfileOnboardingState(user.id);

  return {
    currentStep: session.current_step ?? "welcome",
    completedSteps: Array.isArray(session.completed_steps) ? session.completed_steps : [],
    onboardingComplete: Boolean(profileState.onboarding_complete),
    onboardingCompletedAt: profileState.onboarding_completed_at,
    answers:
      session.answers && typeof session.answers === "object" && !Array.isArray(session.answers)
        ? session.answers
        : {},
  };
}

/**
 * Advance or explicitly set onboarding step
 * - Guarantees session exists
 * - Appends to completed_steps safely
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
    .eq("app", "architecta")
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
      current_step: step,
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

