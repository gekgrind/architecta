import { runGateway } from "@/lib/ai/llm/run";
import { buildPostUserPrompt, parsePostResponse } from "@/lib/ai/llm/prompts/post";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  postGenerateInputSchema,
  postStatusSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

type PostRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  campaign_id: string | null;
  strategy_id: string | null;
  platform: string;
  title: string | null;
  hook: string | null;
  caption: string | null;
  body: string | null;
  hashtags: string[];
  cta: string | null;
  image_prompt: string | null;
  video_prompt: string | null;
  image_asset_id: string | null;
  video_asset_id: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: PostRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    campaignId: row.campaign_id,
    strategyId: row.strategy_id,
    platform: row.platform,
    title: row.title,
    hook: row.hook,
    caption: row.caption,
    body: row.body,
    hashtags: row.hashtags ?? [],
    cta: row.cta,
    imagePrompt: row.image_prompt,
    videoPrompt: row.video_prompt,
    imageAssetId: row.image_asset_id,
    videoAssetId: row.video_asset_id,
    status: row.status,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const campaignId = searchParams.get("campaignId");
  const strategyId = searchParams.get("strategyId");

  let query = supabase
    .from("architecta_posts")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    const parsed = postStatusSchema.safeParse(status);
    if (parsed.success) query = query.eq("status", parsed.data);
  }
  if (platform) query = query.eq("platform", platform);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (strategyId) query = query.eq("strategy_id", strategyId);

  const { data, error } = await query;
  if (error) return apiError("server_error", error.message);

  return apiOk({ posts: (data ?? []).map((row) => toCamel(row as PostRow)) });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = postGenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid post input", {
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

  const userPrompt = buildPostUserPrompt({
    platform: input.platform,
    topic: input.topic,
    keyPoints: input.keyPoints,
    tone: input.tone,
    length: input.length,
    includeCta: input.includeCta,
    ctaText: input.ctaText,
    keywords: input.keywords,
    generateImagePrompt: input.generateImagePrompt,
    generateVideoPrompt: input.generateVideoPrompt,
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
      task: "POST_GENERATION",
      prompt: userPrompt,
      maxTokens: 1800,
      temperature: 0.75,
      metadata: { platform: input.platform },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Post generation failed";
    return apiError("upstream_error", message);
  }

  let post;
  try {
    post = parsePostResponse(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse output";
    return apiError("upstream_error", message);
  }

  const insertRow = {
    user_id: session.user.id,
    workspace_id: input.workspaceId ?? null,
    campaign_id: input.campaignId ?? null,
    strategy_id: input.strategyId ?? null,
    platform: input.platform,
    title: post.title || input.topic.slice(0, 80),
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
    meta: { source_input: input },
  };

  const { data: saved, error: saveError } = await supabase
    .from("architecta_posts")
    .insert(insertRow)
    .select("*")
    .single();

  if (saveError) return apiError("server_error", saveError.message);

  return apiOk({ post: toCamel(saved as PostRow) });
}
