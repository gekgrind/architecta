import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  buildDashboardModel,
  type BrandProfileSource,
  type CampaignSource,
  type ConnectionSource,
  type DashboardResult,
  type DashboardSources,
  type LoadState,
  type OnboardingSource,
  type PostSource,
  type PublishLogSource,
  type StrategySource,
  type WebsiteAnalysisSource,
} from "@/lib/dashboard/model";
import { ARCHITECTA_ONBOARDING_APP } from "@/lib/onboarding/gate";
import { WEBSITE_ANALYSIS_TABLE } from "@/lib/onboarding/website-analysis-jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type QueryResult = { data: unknown; error: unknown };

/** Wraps one query so a single failing source degrades its own section only. */
async function settle<T>(query: PromiseLike<QueryResult>): Promise<LoadState<T>> {
  try {
    const { data, error } = await query;
    if (error) return { ok: false };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false };
  }
}

async function loadWebsiteAnalysis(
  supabase: SupabaseClient,
  onboarding: LoadState<OnboardingSource | null>
): Promise<LoadState<WebsiteAnalysisSource | null>> {
  if (!onboarding.ok) return { ok: false };
  if (!onboarding.data) return { ok: true, data: null };

  // Only columns granted to signed-in users (never evidence or error codes).
  return settle<WebsiteAnalysisSource | null>(
    supabase
      .from(WEBSITE_ANALYSIS_TABLE)
      .select("status, url, completed_at, result")
      .eq("session_id", onboarding.data.id)
      .maybeSingle()
  );
}

async function loadConnections(
  supabase: SupabaseClient,
  userId: string
): Promise<LoadState<ConnectionSource[]>> {
  const [platforms, destinations] = await Promise.all([
    settle<Array<{ platform: string; status: string }>>(
      supabase.from("architecta_platform_connections").select("platform, status").eq("user_id", userId)
    ),
    settle<Array<{ destination: string; status: string }>>(
      supabase
        .from("architecta_content_destinations")
        .select("destination, status")
        .eq("user_id", userId)
    ),
  ]);

  if (!platforms.ok || !destinations.ok) return { ok: false };

  return {
    ok: true,
    data: [
      ...(platforms.data ?? []).map((row) => ({
        kind: "platform" as const,
        name: row.platform,
        status: row.status,
      })),
      ...(destinations.data ?? []).map((row) => ({
        kind: "destination" as const,
        name: row.destination,
        status: row.status,
      })),
    ],
  };
}

export async function loadDashboardSources(
  supabase: SupabaseClient,
  userId: string,
  now: Date
): Promise<DashboardSources> {
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const onboardingPromise = settle<OnboardingSource | null>(
    supabase
      .from("onboarding_sessions")
      .select("id, status, answers")
      .eq("user_id", userId)
      .eq("app", ARCHITECTA_ONBOARDING_APP)
      .maybeSingle()
  );

  const [brandProfile, onboarding, strategies, posts, campaigns, publishLog, connections] =
    await Promise.all([
      settle<BrandProfileSource | null>(
        supabase
          .from("brand_profiles")
          .select(
            "brand_name, industry, website, description, audience, typical_customers, offers, tone, tone_voice, voice_description, mission, source"
          )
          .eq("user_id", userId)
          .maybeSingle()
      ),
      onboardingPromise,
      settle<StrategySource[]>(
        supabase
          .from("architecta_content_strategies")
          .select("id, kind, title, summary, status, pillars, next_actions, quick_wins, meta, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20)
      ),
      settle<PostSource[]>(
        supabase
          .from("architecta_posts")
          .select("status, title, platform, scheduled_for")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(2000)
      ),
      settle<CampaignSource[]>(
        supabase.from("architecta_campaigns").select("status").eq("user_id", userId).limit(500)
      ),
      settle<PublishLogSource[]>(
        supabase
          .from("architecta_publish_log")
          .select("status, platform, created_at")
          .eq("user_id", userId)
          .gte("created_at", since30d)
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      loadConnections(supabase, userId),
    ]);

  const websiteAnalysis = await loadWebsiteAnalysis(supabase, onboarding);

  return {
    brandProfile,
    onboarding,
    websiteAnalysis,
    strategies: strategies.ok ? { ok: true, data: strategies.data ?? [] } : strategies,
    posts: posts.ok ? { ok: true, data: posts.data ?? [] } : posts,
    campaigns: campaigns.ok ? { ok: true, data: campaigns.data ?? [] } : campaigns,
    publishLog: publishLog.ok ? { ok: true, data: publishLog.data ?? [] } : publishLog,
    connections,
  };
}

export type DashboardLoadResult = DashboardResult | { status: "unauthenticated" };

export async function loadDashboard(now: Date = new Date()): Promise<DashboardLoadResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const session = await getAuthenticatedUser(supabase);
    if (!session) return { status: "unauthenticated" };

    const sources = await loadDashboardSources(supabase, session.user.id, now);
    return { status: "ready", model: buildDashboardModel(sources, now) };
  } catch {
    return {
      status: "error",
      message: "Architecta couldn't load your workspace right now. Refresh to try again.",
    };
  }
}
