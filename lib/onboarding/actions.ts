"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import {
  getOrCreateArchitectaOnboarding,
  updateOnboardingStep,
} from "./server";
import {
  saveOnboardingProgress,
  loadSharedBusinessContext,
  loadArchitectaBrandProfile,
  loadOnboardingSession,
  buildPrefillFromSharedContext,
  completeArchitectaOnboardingWithData,
  type OnboardingAnswers,
} from "./persistence";
import { analyzeWebsite } from "./website-analysis";
import { WEBSITE_ANALYSIS_FAILED_MESSAGE } from "./website-step-flow";

const SAVE_FAILED_MESSAGE =
  "Something went wrong saving your answers. Please try again.";

const AUTH_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again to continue.";

/* =======================================================
   Types
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

/* =======================================================
   Save step answers to onboarding_sessions.answers JSONB
======================================================= */

export async function saveStepAnswers(
  stepAnswers: Partial<OnboardingAnswers>,
  step: ArchitectaOnboardingStep
): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === "development") {
    const referer = (await headers()).get("referer") ?? "";
    if (referer.includes("/onboarding/preview")) {
      const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
      const nextStep = ONBOARDING_STEPS[currentIndex + 1]?.id ?? "finish";
      return { ok: true, next: `/onboarding/preview?step=${nextStep}` };
    }
  }

  try {
    const { session } = await getOrCreateArchitectaOnboarding();

    const result = await saveOnboardingProgress(session.id, stepAnswers, step);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
    const nextStep = ONBOARDING_STEPS[currentIndex + 1]?.id ?? "finish";

    await updateOnboardingStep(nextStep as ArchitectaOnboardingStep, false);

    return { ok: true, next: `/onboarding/${nextStep}` };
  } catch (err) {
    console.error("[saveStepAnswers] unexpected failure:", err);
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }
}

/* =======================================================
   Legacy: updateArchitectaOnboarding (now routes to answers JSONB)
======================================================= */

export async function updateArchitectaOnboarding(data: Record<string, unknown>) {
  try {
    const { session } = await getOrCreateArchitectaOnboarding();

    const result = await saveOnboardingProgress(
      session.id,
      data as Partial<OnboardingAnswers>,
      (session.current_step ?? "welcome") as ArchitectaOnboardingStep
    );

    return result;
  } catch (err) {
    console.error("[updateArchitectaOnboarding] unexpected failure:", err);
    return { ok: false as const, error: SAVE_FAILED_MESSAGE };
  }
}

export async function setArchitectaOnboardingStep(step: ArchitectaOnboardingStep) {
  return updateOnboardingStep(step, true);
}

/* =======================================================
   Blueprint onboarding: Continue → persist → (client) navigate
======================================================= */

export async function advanceArchitectaOnboardingStepClient(
  currentStep: ArchitectaOnboardingStep
) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { ok: false as const, error: AUTH_EXPIRED_MESSAGE };

    const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

    if (currentIndex === -1) {
      return { ok: false as const, error: SAVE_FAILED_MESSAGE };
    }

    const nextStep = (ONBOARDING_STEPS[currentIndex + 1]?.id ?? "finish") as ArchitectaOnboardingStep;

    await updateOnboardingStep(nextStep, true);

    return { ok: true as const, next: `/onboarding/${nextStep}`, nextStep };
  } catch (err) {
    console.error("[advanceStep] unexpected failure:", err);
    return { ok: false as const, error: SAVE_FAILED_MESSAGE };
  }
}

/* =======================================================
   Load onboarding context (shared profile + brand + session)
======================================================= */

export async function loadOnboardingContext() {
  const [shared, brand, session] = await Promise.all([
    loadSharedBusinessContext(),
    loadArchitectaBrandProfile(),
    loadOnboardingSession(),
  ]);

  const prefill = buildPrefillFromSharedContext(shared, brand);

  const answers: OnboardingAnswers = {
    ...prefill,
    ...(session?.answers ?? {}),
  };

  const hasExistingContext = !!(
    shared?.industry ||
    shared?.name ||
    shared?.website_url ||
    shared?.audience ||
    shared?.offer ||
    shared?.business_idea
  );

  const hasWebsiteUrl = !!(
    answers.website_url ||
    shared?.website_url ||
    shared?.website ||
    brand?.website
  );

  return {
    shared,
    brand,
    session,
    answers,
    prefill,
    hasExistingContext,
    hasWebsiteUrl,
    websiteUrl: answers.website_url ?? shared?.website_url ?? shared?.website ?? brand?.website ?? null,
  };
}

/* =======================================================
   Website Analysis (server action)
======================================================= */

export async function runWebsiteAnalysis(url: string) {
  if (process.env.NODE_ENV === "development") {
    const referer = (await headers()).get("referer") ?? "";
    if (referer.includes("/onboarding/preview")) {
      return {
        ok: true as const,
        analysis: {
          brand_name: "Acme Studio",
          industry: "B2B SaaS",
          description: "Strategic content tools for modern founders",
          audience: "Solo founders, indie hackers, and bootstrapped teams",
          offers: "Brand kit generation, content strategy templates",
          tone: "Direct, confident, practical",
          voice_characteristics: "Clear, no-fluff, founder-to-founder",
          topics: ["brand building", "content strategy", "growth marketing"],
          mission: "Make brand-building accessible to every founder.",
          values: "Clarity, Integrity, Simplicity",
          differentiators: ["Built for solo founders", "System-first approach"],
          cta_patterns: ["Start building", "Get your brand kit"],
          typical_customers: "Solo founders and small bootstrapped teams",
          confidence: "high" as const,
          analyzed_at: new Date().toISOString(),
        },
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  try {
    // analyzeWebsite returns only user-safe error strings.
    const result = await analyzeWebsite(user.id, url);

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    const { session } = await getOrCreateArchitectaOnboarding();

    const saved = await saveOnboardingProgress(
      session.id,
      { website_analysis: result.analysis },
      "website"
    );

    if (!saved.ok) {
      console.error("[website-analysis] failed to persist analysis:", saved.error);
      return { ok: false as const, error: WEBSITE_ANALYSIS_FAILED_MESSAGE };
    }

    return { ok: true as const, analysis: result.analysis };
  } catch (err) {
    console.error(
      "[website-analysis] unexpected failure:",
      err
    );
    return { ok: false as const, error: WEBSITE_ANALYSIS_FAILED_MESSAGE };
  }
}

/* =======================================================
   Complete Onboarding (final persistence)
======================================================= */

export async function completeOnboarding() {
  try {
    const session = await loadOnboardingSession();
    if (!session) return { ok: false as const, error: AUTH_EXPIRED_MESSAGE };

    const result = await completeArchitectaOnboardingWithData(session.answers);

    if (!result.ok) {
      console.error("[completeOnboarding] completion failed:", result.error);
      return { ok: false as const, error: SAVE_FAILED_MESSAGE };
    }

    return { ok: true as const, next: "/dashboard" };
  } catch (err) {
    console.error("[completeOnboarding] unexpected failure:", err);
    return { ok: false as const, error: SAVE_FAILED_MESSAGE };
  }
}
