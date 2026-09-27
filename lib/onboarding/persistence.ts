import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ARCHITECTA_ONBOARDING_APP, ONBOARDING_SESSION_STATUS } from "./gate";
import { getFurthestStep, type OnboardingStepId } from "./steps";

/* =======================================================
   Types — Onboarding Answers (stored in onboarding_sessions.answers JSONB)
======================================================= */

export type OnboardingAnswers = {
  source_type?: string;
  has_website?: boolean;
  website_url?: string;
  brand_name?: string;
  industry?: string;
  description?: string;
  primary_market?: string;
  niche?: string;
  competitors?: string[];
  customer_role?: string;
  customer_pains?: string[];
  customer_outcome?: string;
  brand_values?: string[];
  brand_personality?: {
    boldness?: number;
    tone?: number;
    authority?: number;
  };
  voice_tone?: string;
  words_to_use?: string[];
  words_to_avoid?: string[];
  reference_brands?: string[];
  visual_style?: string;
  primary_colors?: string[];
  has_logo?: boolean;
  mission?: string;
  vision?: string;
  values_text?: string;
  offers?: string;
  typical_customers?: string;
  audience?: string;
  tone_voice?: string;
  voice_description?: string;
  website_analysis?: WebsiteAnalysisResult | null;
};

export type WebsiteAnalysisResult = {
  brand_name?: string;
  industry?: string;
  description?: string;
  audience?: string;
  offers?: string;
  tone?: string;
  voice_characteristics?: string;
  topics?: string[];
  mission?: string;
  values?: string;
  differentiators?: string[];
  cta_patterns?: string[];
  typical_customers?: string;
  confidence: "high" | "medium" | "low";
  analyzed_at: string;
};

/* =======================================================
   Shared Business Context (profiles table)

   Read-only ecosystem context. Architecta deliberately does not read the
   shared onboarding flags (they describe Entrepreneuria onboarding) or the
   personal `name` (a person's name is not their brand name).
======================================================= */

export type SharedBusinessContext = {
  id: string;
  email: string | null;
  full_name: string | null;
  industry: string | null;
  business_stage: string | null;
  stage: string | null;
  website: string | null;
  website_url: string | null;
  has_website: boolean | null;
  audience: string | null;
  offer: string | null;
  business_idea: string | null;
  business_focus: string | null;
  goal_90_day: string | null;
  goal90: string | null;
  experience_level: string | null;
};

export async function loadSharedBusinessContext(): Promise<SharedBusinessContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, industry, business_stage, stage, website, website_url, has_website, audience, offer, business_idea, business_focus, goal_90_day, goal90, experience_level"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as SharedBusinessContext;
}

/* =======================================================
   Brand Profile
======================================================= */

export type BrandProfileData = {
  id: string;
  user_id: string;
  brand_name: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  audience: string | null;
  tone: string | null;
  tone_voice: string | null;
  voice_description: string | null;
  topics: Record<string, unknown> | null;
  offers: string | null;
  mission: string | null;
  vision: string | null;
  values: string | null;
  typical_customers: string | null;
  banned_phrases: string[] | null;
  required_elements: string[] | null;
  source: Record<string, unknown> | null;
};

export async function loadArchitectaBrandProfile(): Promise<BrandProfileData | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return null;

  return data as BrandProfileData | null;
}

/* =======================================================
   Onboarding Session
======================================================= */

export type OnboardingSessionData = {
  id: string;
  user_id: string;
  app: string;
  current_step: string | null;
  completed_steps: string[];
  flags: Record<string, unknown>;
  answers: OnboardingAnswers;
  status: string | null;
};

export async function loadOnboardingSession(): Promise<OnboardingSessionData | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("app", ARCHITECTA_ONBOARDING_APP)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    completed_steps: Array.isArray(data.completed_steps) ? data.completed_steps : [],
    flags:
      data.flags && typeof data.flags === "object" && !Array.isArray(data.flags)
        ? (data.flags as Record<string, unknown>)
        : {},
    answers:
      data.answers && typeof data.answers === "object" && !Array.isArray(data.answers)
        ? (data.answers as OnboardingAnswers)
        : {},
  } as OnboardingSessionData;
}

/* =======================================================
   Save Onboarding Progress (answers JSONB merge)
======================================================= */

export async function saveOnboardingProgress(
  sessionId: string,
  stepAnswers: Partial<OnboardingAnswers>,
  step: OnboardingStepId
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: session, error: fetchError } = await supabase
    .from("onboarding_sessions")
    .select("id, answers, completed_steps, current_step")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return { ok: false, error: fetchError?.message ?? "Session not found" };
  }

  const existingAnswers =
    session.answers && typeof session.answers === "object" && !Array.isArray(session.answers)
      ? (session.answers as OnboardingAnswers)
      : {};

  const mergedAnswers: OnboardingAnswers = { ...existingAnswers, ...stepAnswers };

  const completedSteps: string[] = Array.isArray(session.completed_steps)
    ? session.completed_steps
    : [];
  const nextCompleted = completedSteps.includes(step)
    ? completedSteps
    : [...completedSteps, step];

  const { error: updateError } = await supabase
    .from("onboarding_sessions")
    .update({
      answers: mergedAnswers,
      // Re-saving an earlier step (back navigation) must not rewind progress.
      current_step: getFurthestStep(session.current_step, step),
      completed_steps: nextCompleted,
    })
    .eq("id", session.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

/* =======================================================
   Persist Shared Business Facts (profiles)

   Backfill only: a shared column is written only when it is currently
   empty, so Architecta never overwrites what Entrepreneuria (or the user)
   already recorded. Identity (`name`) and onboarding flags are never
   written from here.
======================================================= */

const SHARED_BUSINESS_FACT_COLUMNS =
  "industry, website, website_url, has_website, audience, offer, business_idea";

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export async function persistSharedBusinessFacts(
  facts: {
    industry?: string;
    website_url?: string;
    has_website?: boolean;
    audience?: string;
    offer?: string;
    business_idea?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const candidates: Record<string, unknown> = {
    industry: facts.industry,
    website_url: facts.website_url,
    website: facts.website_url,
    has_website: facts.has_website,
    audience: facts.audience,
    offer: facts.offer,
    business_idea: facts.business_idea,
  };

  if (Object.values(candidates).every(isBlank)) return { ok: true };

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select(SHARED_BUSINESS_FACT_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };

  // No shared row to backfill (an update would match nothing anyway).
  if (!current) return { ok: true };

  const existing = current as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(candidates)) {
    if (!isBlank(value) && isBlank(existing[column])) {
      patch[column] = value;
    }
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/* =======================================================
   Persist Architecta Brand Profile (upsert brand_profiles)
======================================================= */

export async function persistArchitectaBrandProfile(
  data: {
    brand_name?: string;
    industry?: string;
    website?: string;
    description?: string;
    audience?: string;
    tone?: string;
    tone_voice?: string;
    voice_description?: string;
    topics?: Record<string, unknown>;
    offers?: string;
    mission?: string;
    vision?: string;
    values?: string;
    typical_customers?: string;
    banned_phrases?: string[];
    required_elements?: string[];
    source?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const patch: Record<string, unknown> = { user_id: user.id };

  if (data.brand_name !== undefined) patch.brand_name = data.brand_name;
  if (data.industry !== undefined) patch.industry = data.industry;
  if (data.website !== undefined) patch.website = data.website;
  if (data.description !== undefined) patch.description = data.description;
  if (data.audience !== undefined) patch.audience = data.audience;
  if (data.tone !== undefined) patch.tone = data.tone;
  if (data.tone_voice !== undefined) patch.tone_voice = data.tone_voice;
  if (data.voice_description !== undefined) patch.voice_description = data.voice_description;
  if (data.topics !== undefined) patch.topics = data.topics;
  if (data.offers !== undefined) patch.offers = data.offers;
  if (data.mission !== undefined) patch.mission = data.mission;
  if (data.vision !== undefined) patch.vision = data.vision;
  if (data.values !== undefined) patch.values = data.values;
  if (data.typical_customers !== undefined) patch.typical_customers = data.typical_customers;
  if (data.banned_phrases !== undefined) patch.banned_phrases = data.banned_phrases;
  if (data.required_elements !== undefined) patch.required_elements = data.required_elements;
  if (data.source !== undefined) patch.source = data.source;

  const { error } = await supabase
    .from("brand_profiles")
    .upsert(patch, { onConflict: "user_id" })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/* =======================================================
   Complete Architecta Onboarding
======================================================= */

export async function completeArchitectaOnboardingWithData(
  answers: OnboardingAnswers
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  // A "low" confidence analysis is context, not a fact — it backfills gaps
  // in the brand profile below but never overwrites a real user answer.
  const wa = answers.website_analysis;
  const websiteConfident = !!wa && wa.confidence !== "low";

  // 1. Persist shared business facts to profiles
  //    Backfill-only; the brand name is Architecta brand data (brand_profiles),
  //    never the person's shared profile name.
  const sharedResult = await persistSharedBusinessFacts({
    industry: answers.industry,
    website_url: answers.website_url,
    has_website: answers.has_website,
    audience: answers.audience ?? answers.customer_role,
    offer: answers.description,
  });

  if (!sharedResult.ok) {
    return { ok: false, error: `Failed to update shared profile: ${sharedResult.error}` };
  }

  // 2. Build brand profile from answers
  const toneVoice = answers.voice_tone
    ? buildToneVoiceDescription(answers.voice_tone, answers.brand_personality)
    : undefined;

  const brandResult = await persistArchitectaBrandProfile({
    brand_name: answers.brand_name,
    industry: answers.industry,
    website: answers.website_url,
    description: answers.description,
    audience: buildAudienceDescription(answers),
    tone: answers.voice_tone,
    tone_voice: toneVoice,
    voice_description: toneVoice,
    topics: answers.words_to_use
      ? { include: answers.words_to_use, avoid: answers.words_to_avoid ?? [] }
      : undefined,
    // offers/mission are extracted during website analysis but no onboarding
    // step asks about them directly — fall back to that evidence instead of
    // discarding it, but only ever as a gap-filler behind the user's answer.
    offers: answers.offers ?? (websiteConfident ? wa?.offers : undefined) ?? answers.description,
    mission: answers.mission ?? (websiteConfident ? wa?.mission : undefined),
    vision: answers.vision,
    values: answers.brand_values?.join(", "),
    typical_customers: answers.typical_customers ?? answers.customer_role,
    banned_phrases: answers.words_to_avoid,
    required_elements: answers.words_to_use,
    source: {
      onboarding: true,
      hasWebsiteAnalysis: !!wa,
      completedAt: new Date().toISOString(),
      // topics/differentiators/cta_patterns have no onboarding question of
      // their own — preserved here as business intelligence instead of
      // being thrown away after paying the model cost to extract them.
      ...(wa
        ? {
            websiteInsights: {
              topics: wa.topics,
              differentiators: wa.differentiators,
              cta_patterns: wa.cta_patterns,
              confidence: wa.confidence,
              analyzed_at: wa.analyzed_at,
            },
          }
        : {}),
    },
  });

  if (!brandResult.ok) {
    return { ok: false, error: `Failed to update brand profile: ${brandResult.error}` };
  }

  // 3. Mark the Architecta onboarding session completed. This is the sole
  //    record of Architecta onboarding completion; the shared
  //    profiles.onboarding_* fields belong to Entrepreneuria and are left alone.
  const { data: completedSessions, error: sessionError } = await supabase
    .from("onboarding_sessions")
    .update({
      current_step: "finish",
      status: ONBOARDING_SESSION_STATUS.completed,
    })
    .eq("user_id", user.id)
    .eq("app", ARCHITECTA_ONBOARDING_APP)
    .select("id");

  if (sessionError) {
    return { ok: false, error: `Failed to complete session: ${sessionError.message}` };
  }

  if (!Array.isArray(completedSessions) || completedSessions.length === 0) {
    return { ok: false, error: "Failed to complete session: onboarding session not found" };
  }

  return { ok: true };
}

/* =======================================================
   Helpers
======================================================= */

function buildAudienceDescription(answers: OnboardingAnswers): string | undefined {
  const parts: string[] = [];
  if (answers.customer_role) parts.push(answers.customer_role);
  if (answers.customer_pains?.length) {
    parts.push(`Pain points: ${answers.customer_pains.join(", ")}`);
  }
  if (answers.customer_outcome) {
    parts.push(`Desired outcome: ${answers.customer_outcome}`);
  }
  return parts.length > 0 ? parts.join(". ") : undefined;
}

function buildToneVoiceDescription(
  tone: string,
  personality?: OnboardingAnswers["brand_personality"]
): string {
  const parts = [tone];
  if (personality) {
    if (personality.boldness !== undefined) {
      parts.push(personality.boldness > 60 ? "bold" : personality.boldness < 40 ? "reserved" : "balanced");
    }
    if (personality.authority !== undefined) {
      parts.push(personality.authority > 60 ? "authoritative" : personality.authority < 40 ? "approachable" : "balanced authority");
    }
  }
  return parts.join(", ");
}

/* =======================================================
   Prefill: Merge shared context into onboarding answers
======================================================= */

export function buildPrefillFromSharedContext(
  shared: SharedBusinessContext | null,
  brand: BrandProfileData | null
): OnboardingAnswers {
  const prefill: OnboardingAnswers = {};

  if (shared) {
    if (shared.industry) prefill.industry = shared.industry;
    if (shared.website_url || shared.website) {
      prefill.website_url = shared.website_url ?? shared.website ?? undefined;
      prefill.has_website = true;
    } else if (shared.has_website === false) {
      prefill.has_website = false;
    }
    if (shared.audience) {
      prefill.audience = shared.audience;
      // The Customers step's "who is your ideal customer" answer is the same
      // fact Architecta writes back to profiles.audience on completion.
      prefill.customer_role = shared.audience;
    }
    if (shared.offer) prefill.description = shared.offer;
    if (shared.business_idea) {
      prefill.description = prefill.description ?? shared.business_idea;
    }
  }

  if (brand) {
    if (brand.brand_name) prefill.brand_name = brand.brand_name;
    if (brand.industry) prefill.industry = brand.industry;
    if (brand.website) {
      prefill.website_url = brand.website;
      prefill.has_website = true;
    }
    if (brand.description) prefill.description = brand.description;
    if (brand.audience) prefill.customer_role = brand.audience;
    if (brand.tone) prefill.voice_tone = brand.tone;
    if (brand.tone_voice) prefill.tone_voice = brand.tone_voice;
    if (brand.values) prefill.brand_values = brand.values.split(", ").filter(Boolean);
    if (brand.offers) prefill.offers = brand.offers;
    if (brand.mission) prefill.mission = brand.mission;
    if (brand.vision) prefill.vision = brand.vision;
    if (brand.typical_customers) prefill.typical_customers = brand.typical_customers;
    if (brand.banned_phrases?.length) prefill.words_to_avoid = brand.banned_phrases;
    if (brand.required_elements?.length) prefill.words_to_use = brand.required_elements;
  }

  return prefill;
}
