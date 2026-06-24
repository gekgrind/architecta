import { runGateway } from "@/lib/ai/llm/run";
import {
  buildCampaignUserPrompt,
  parseCampaignResponse,
} from "@/lib/ai/llm/prompts/campaign";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { campaignGenerateInputSchema } from "@/lib/validation/campaign";

export const runtime = "nodejs";

type CampaignRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  strategy_id: string | null;
  name: string;
  theme: string | null;
  goal: string | null;
  launch_date: string | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: CampaignRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    strategyId: row.strategy_id,
    name: row.name,
    theme: row.theme,
    goal: row.goal,
    launchDate: row.launch_date,
    status: row.status,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data: campaigns, error } = await supabase
    .from("architecta_campaigns")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return apiError("server_error", error.message);

  const campaignIds = (campaigns ?? []).map((row) => row.id);
  let postCounts: Record<string, number> = {};
  if (campaignIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from("architecta_posts")
      .select("campaign_id")
      .eq("user_id", session.user.id)
      .in("campaign_id", campaignIds);

    if (postsError) return apiError("server_error", postsError.message);

    postCounts = (posts ?? []).reduce<Record<string, number>>((acc, row) => {
      const id = row.campaign_id as string | null;
      if (id) acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return apiOk({
    campaigns: (campaigns ?? []).map((row) => ({
      ...toCamel(row as CampaignRow),
      postCount: postCounts[row.id] ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const limited = await enforceRateLimit(session.user.id, RATE_LIMITS.campaignGenerate);
  if (limited) return limited;

  const body = await parseJsonBody<unknown>(req);
  const parsed = campaignGenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid campaign input", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  const [{ data: brand }, { data: founder }, { data: strategy }] =
    await Promise.all([
      supabase
        .from("brand_profiles")
        .select(
          "brand_name, industry, audience, voice_description, banned_phrases, required_elements"
        )
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("founder_style_profiles")
        .select("profile_text")
        .eq("user_id", session.user.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      input.strategyId
        ? supabase
            .from("architecta_content_strategies")
            .select("summary")
            .eq("user_id", session.user.id)
            .eq("id", input.strategyId)
            .maybeSingle()
        : Promise.resolve({ data: null as { summary: string | null } | null }),
    ]);

  const prompt = buildCampaignUserPrompt({
    name: input.name,
    theme: input.theme,
    goal: input.goal,
    launchDate: input.launchDate ?? null,
    platforms: input.platforms,
    postsPerPlatform: input.postsPerPlatform,
    includeEmail: input.includeEmail,
    includeBlog: input.includeBlog,
    brand: brand
      ? {
          brandName: brand.brand_name,
          industry: brand.industry,
          audience: brand.audience,
          voiceDescription: brand.voice_description,
          bannedPhrases: brand.banned_phrases,
          requiredElements: brand.required_elements,
        }
      : null,
    founderStyle: founder?.profile_text ?? null,
    strategySummary: strategy?.summary ?? null,
  });

  let result;
  try {
    result = await runGateway({
      userId: session.user.id,
      workspaceId: input.workspaceId ?? null,
      task: "CAMPAIGN_PLAN",
      prompt,
      maxTokens: 4000,
      temperature: 0.65,
      metadata: { campaign_name: input.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Campaign generation failed";
    return apiError("upstream_error", message);
  }

  let plan;
  try {
    plan = parseCampaignResponse(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse output";
    return apiError("upstream_error", message);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("architecta_campaigns")
    .insert({
      user_id: session.user.id,
      workspace_id: input.workspaceId ?? null,
      strategy_id: input.strategyId ?? null,
      name: input.name,
      theme: input.theme,
      goal: input.goal,
      launch_date: input.launchDate ?? null,
      status: "planning",
      meta: {
        summary: plan.summary,
        launchSequence: plan.launchSequence,
        promotionalAngles: plan.promotionalAngles,
        repurposingIdeas: plan.repurposingIdeas,
        source_input: input,
        ai_provider: result.provider,
        ai_model: result.model,
      },
    })
    .select("*")
    .single();

  if (campaignError) return apiError("server_error", campaignError.message);

  const requestedPlatforms = new Set(input.platforms.map((p) => p.toLowerCase()));
  if (input.includeEmail) requestedPlatforms.add("email");
  if (input.includeBlog) requestedPlatforms.add("blog");

  const postRows = plan.posts
    .filter((post) => requestedPlatforms.has(post.platform.toLowerCase()))
    .map((post) => ({
      user_id: session.user.id,
      workspace_id: input.workspaceId ?? null,
      campaign_id: campaign.id as string,
      strategy_id: input.strategyId ?? null,
      platform: post.platform.toLowerCase(),
      title: post.title || `${input.name} — ${post.platform}`,
      hook: post.hook,
      caption: post.caption,
      body: post.body,
      hashtags: post.hashtags,
      cta: post.cta,
      image_prompt: post.imagePrompt || null,
      video_prompt: post.videoPrompt || null,
      status: "draft" as const,
      ai_provider: result.provider,
      ai_model: result.model,
      meta: { campaign_name: input.name },
    }));

  let insertedPosts: unknown[] = [];
  if (postRows.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from("architecta_posts")
      .insert(postRows)
      .select("*");

    if (postsError) return apiError("server_error", postsError.message);
    insertedPosts = posts ?? [];
  }

  return apiOk({
    campaign: toCamel(campaign as CampaignRow),
    posts: insertedPosts,
    plan,
  });
}
