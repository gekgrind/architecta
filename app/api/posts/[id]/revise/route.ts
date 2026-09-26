import { runGateway } from "@/lib/ai/llm/run";
import { buildPostRevisionPrompt } from "@/lib/ai/llm/prompts/post";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { enforceAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postReviseInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const limited = await enforceAiUsage(session.user.id, RATE_LIMITS.postRevise);
  if (limited) return limited;

  const body = await parseJsonBody<unknown>(req);
  const parsed = postReviseInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid revision input", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  const { data: post, error: postError } = await supabase
    .from("architecta_posts")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("id", id)
    .maybeSingle();
  if (postError) return apiError("server_error", postError.message);
  if (!post) return apiError("not_found", "Post not found");

  const [{ data: brand }, { data: founder }] = await Promise.all([
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
  ]);

  const draft = post.caption ?? post.body ?? "";
  const prompt = buildPostRevisionPrompt({
    platform: post.platform,
    draft,
    tone: input.tone,
    length: input.length,
    ctaStrength: input.ctaStrength,
    customInstructions: input.customInstructions,
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
  });

  let result;
  try {
    result = await runGateway({
      userId: session.user.id,
      task: "POST_REVISION",
      prompt,
      maxTokens: 1200,
      temperature: 0.45,
      metadata: { post_id: id },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revision failed";
    return apiError("upstream_error", message);
  }

  const revised = result.text.trim();

  const { data: updated, error: updateError } = await supabase
    .from("architecta_posts")
    .update({
      caption: revised,
      body: revised,
      ai_provider: result.provider,
      ai_model: result.model,
    })
    .eq("user_id", session.user.id)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return apiError("server_error", updateError.message);

  return apiOk({ post: updated });
}
