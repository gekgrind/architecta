"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateArchitectaOnboarding,
  setOnboardingFlag,
  updateOnboardingStep,
} from "./server";

/* =======================================================
   Generic helpers (used by ALL onboarding steps)
======================================================= */

export type ArchitectaOnboardingStep =
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
 * Update arbitrary onboarding session fields
 * Safe to reuse across all steps
 */
export async function updateArchitectaOnboarding(
  data: Record<string, any>
) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { session } = await getOrCreateArchitectaOnboarding();

  const { error } = await supabase
    .from("onboarding_sessions")
    .update(data)
    .eq("id", session.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Explicitly set the current onboarding step
 */
export async function setArchitectaOnboardingStep(
  step: ArchitectaOnboardingStep
) {
  return updateOnboardingStep(step, true);
}

/* =======================================================
   Import brand data from Prospra
======================================================= */

export async function importFromProspra() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  // ⚠️ Adjust table name if needed
  const { data: prospra, error } = await supabase
    .from("prospra_brand_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!prospra) {
    return { ok: false, error: "No Prospra data found." };
  }

  const { error: updateError } = await supabase
    .from("brand_profiles")
    .update({
      brand_name: prospra.brand_name,
      offers: prospra.offers,
      mission: prospra.mission,
      vision: prospra.vision,
      values: prospra.values,
      tone_voice: prospra.tone_voice,
      source: { fromProspra: true },
    })
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await setOnboardingFlag("usedProspra", true);
  await updateOnboardingStep("source", true);

  return { ok: true, next: "/onboarding/website" };
}

/* =======================================================
   Complete Architecta onboarding
======================================================= */

export async function completeOnboarding() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("onboarding_sessions")
    .update({
      status: "completed",
      current_step: "finish",
    })
    .eq("user_id", user.id)
    .eq("app", "architecta");

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, next: "/studio" };
}
