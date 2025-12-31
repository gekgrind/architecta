import { createSupabaseServerClient } from "@/lib/supabase/server"; // your existing helper
import type { OnboardingStepId } from "./steps";

export async function getOrCreateArchitectaOnboarding() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // session
  const { data: session } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", "architecta")
    .maybeSingle();

  let finalSession = session;

  if (!finalSession) {
    const { data: inserted, error } = await supabase
      .from("onboarding_sessions")
      .insert({
        user_id: user.id,
        app: "architecta",
        current_step: "welcome",
      })
      .select("*")
      .single();
    if (error) throw error;
    finalSession = inserted;
  }

  // brand profile
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let finalProfile = profile;
  if (!finalProfile) {
    const { data: inserted, error } = await supabase
      .from("brand_profiles")
      .insert({ user_id: user.id })
      .select("*")
      .single();
    if (error) throw error;
    finalProfile = inserted;
  }

  return { user, session: finalSession, profile: finalProfile };
}

export async function updateOnboardingStep(step: OnboardingStepId, complete?: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // fetch session
  const { data: session, error } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", "architecta")
    .single();
  if (error) throw error;

  const completed = Array.isArray(session.completed_steps) ? session.completed_steps : [];
  const nextCompleted = complete && !completed.includes(step)
    ? [...completed, step]
    : completed;

  const { error: upErr } = await supabase
    .from("onboarding_sessions")
    .update({
      current_step: step,
      completed_steps: nextCompleted,
    })
    .eq("id", session.id);

  if (upErr) throw upErr;
}

export async function setOnboardingFlag(flagKey: string, value: any) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: session, error } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", "architecta")
    .single();
  if (error) throw error;

  const flags = session.flags ?? {};
  const nextFlags = { ...flags, [flagKey]: value };

  const { error: upErr } = await supabase
    .from("onboarding_sessions")
    .update({ flags: nextFlags })
    .eq("id", session.id);

  if (upErr) throw upErr;
}
