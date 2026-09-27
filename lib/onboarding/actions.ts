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
import { after } from "next/server";
import {
  enqueueWebsiteAnalysis,
  getWebsiteAnalysisForSession,
  processWebsiteAnalysisJob,
} from "./website-analysis-jobs";
import {
  composeWebsiteAnalysis,
  WEBSITE_ANALYSIS_FAILED_MESSAGE,
  type WebsiteAnalysisStatus,
} from "./website-step-flow";
import type { WebsiteAnalysisResult } from "./persistence";

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

  // Background analysis is composed in at read time; it is never persisted
  // into the session's answers.
  const websiteAnalysis = session ? await getWebsiteAnalysisForSession(session.id) : null;

  const answers: OnboardingAnswers = composeWebsiteAnalysis(
    {
      ...prefill,
      ...(session?.answers ?? {}),
    },
    websiteAnalysis
  );

  const hasExistingContext = !!(
    shared?.industry ||
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
    websiteAnalysisStatus: websiteAnalysis?.status ?? null,
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
    const { session } = await getOrCreateArchitectaOnboarding();

    // Fetch/extract synchronously (fast), queue the model call. Errors
    // returned here are user-safe (unreadable site, usage limits).
    const queued = await enqueueWebsiteAnalysis({
      userId: user.id,
      sessionId: session.id,
      url,
    });

    if (!queued.ok) {
      return { ok: false as const, error: queued.error };
    }

    if (queued.status === "queued") {
      // Fast path only: one model attempt after the response is sent. If this
      // never runs (restart, deploy), the job stays queued/stale and the
      // authenticated cron processor picks it up.
      const jobId = queued.jobId;
      try {
        after(async () => {
          try {
            await processWebsiteAnalysisJob(jobId);
          } catch (err) {
            console.error("[website-analysis] background attempt failed:", err instanceof Error ? err.message : err);
          }
        });
      } catch (err) {
        console.warn("[website-analysis] could not schedule fast path; cron will process the job:", err instanceof Error ? err.message : err);
      }
    }

    return { ok: true as const, status: queued.status };
  } catch (err) {
    console.error(
      "[website-analysis] unexpected failure:",
      err
    );
    return { ok: false as const, error: WEBSITE_ANALYSIS_FAILED_MESSAGE };
  }
}

/* =======================================================
   Website Analysis status (Snapshot polling)
======================================================= */

export async function getWebsiteAnalysisStatus(): Promise<{
  status: WebsiteAnalysisStatus | null;
  analysis: WebsiteAnalysisResult | null;
}> {
  try {
    const session = await loadOnboardingSession();
    if (!session) return { status: null, analysis: null };

    const job = await getWebsiteAnalysisForSession(session.id);
    return { status: job?.status ?? null, analysis: job?.result ?? null };
  } catch {
    return { status: null, analysis: null };
  }
}

/* =======================================================
   Complete Onboarding (final persistence)
======================================================= */

export async function completeOnboarding() {
  try {
    const session = await loadOnboardingSession();
    if (!session) return { ok: false as const, error: AUTH_EXPIRED_MESSAGE };

    // A completed background analysis is composed in (read time), never
    // written back into answers; user answers keep precedence downstream.
    const websiteAnalysis = await getWebsiteAnalysisForSession(session.id);
    const result = await completeArchitectaOnboardingWithData(
      composeWebsiteAnalysis(session.answers, websiteAnalysis)
    );

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
