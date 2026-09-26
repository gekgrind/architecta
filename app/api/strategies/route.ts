import { runGateway } from "@/lib/ai/llm/run";
import {
  buildStrategyUserPrompt,
  parseStrategyResponse,
  type StrategyKind,
} from "@/lib/ai/llm/prompts/strategy";
import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { enforceAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { strategyGenerateInputSchema } from "@/lib/validation/strategy";

export const runtime = "nodejs";

const ALLOWED_KINDS = [
  "content_strategy",
  "content_architect",
  "strategy_engine",
  "custom",
] as const;

type StrategyRow = {
  id: string;
  kind: string;
  title: string | null;
  summary: string | null;
  pillars: unknown;
  audience_angles: unknown;
  content_themes: unknown;
  posting_cadence: unknown;
  quick_wins: unknown;
  next_actions: unknown;
  campaigns_seed: unknown;
  platform_strategy: unknown;
  source_input: unknown;
  status: string;
  ai_provider: string | null;
  ai_model: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: StrategyRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    pillars: row.pillars ?? [],
    audienceAngles: row.audience_angles ?? [],
    contentThemes: row.content_themes ?? [],
    postingCadence: row.posting_cadence ?? [],
    quickWins: row.quick_wins ?? [],
    nextActions: row.next_actions ?? [],
    campaignsSeed: row.campaigns_seed ?? [],
    platformStrategy: row.platform_strategy ?? {},
    sourceInput: row.source_input ?? {},
    status: row.status,
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
  const kind = searchParams.get("kind");

  let query = supabase
    .from("architecta_content_strategies")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (kind && (ALLOWED_KINDS as readonly string[]).includes(kind)) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await query;
  if (error) return apiError("server_error", error.message);

  return apiOk({
    strategies: (data ?? []).map((row) => toCamel(row as StrategyRow)),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const limited = await enforceAiUsage(session.user.id, RATE_LIMITS.strategyGenerate);
  if (limited) return limited;

  const body = await parseJsonBody<unknown>(req);

  const baseParsed = strategyGenerateInputSchema.safeParse(body);
  if (!baseParsed.success) {
    return apiError("validation_error", "Invalid strategy input", {
      details: { issues: baseParsed.error.flatten() },
    });
  }
  const input = baseParsed.data;

  const rawKind =
    body && typeof body === "object" && "kind" in body
      ? (body as { kind?: unknown }).kind
      : undefined;
  const kind: StrategyKind =
    rawKind === "content_architect" || rawKind === "strategy_engine"
      ? rawKind
      : "content_strategy";

  const userPrompt = buildStrategyUserPrompt({
    kind,
    businessNiche: input.businessNiche,
    targetAudience: input.targetAudience,
    contentGoals: input.contentGoals,
    offerProduct: input.offerProduct,
    preferredPlatforms: input.preferredPlatforms,
    toneBrandStyle: input.toneBrandStyle,
    currentChallenge: input.currentChallenge,
    primaryGoal: input.primaryGoal,
  });

  let result;
  try {
    result = await runGateway({
      userId: session.user.id,
      workspaceId: input.workspaceId ?? null,
      task: "CONTENT_STRATEGY",
      prompt: userPrompt,
      maxTokens: 2400,
      temperature: 0.6,
      metadata: { kind },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Strategy generation failed";
    return apiError("upstream_error", message);
  }

  let parsed;
  try {
    parsed = parseStrategyResponse(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse output";
    return apiError("upstream_error", message);
  }

  const title =
    input.businessNiche.length > 80
      ? `${input.businessNiche.slice(0, 77)}...`
      : `${input.businessNiche} strategy`;

  const insertRow = {
    user_id: session.user.id,
    workspace_id: input.workspaceId ?? null,
    brand_profile_id: input.brandProfileId ?? null,
    kind,
    title,
    summary: parsed.summary,
    pillars: parsed.contentPillars,
    audience_angles: parsed.audienceAngles,
    content_themes: parsed.contentThemes,
    posting_cadence: parsed.postingCadence,
    quick_wins: parsed.quickWins,
    next_actions: parsed.nextActions,
    campaigns_seed: parsed.postIdeas,
    platform_strategy: { preferredPlatforms: input.preferredPlatforms },
    source_input: input,
    status: "draft" as const,
    ai_provider: result.provider,
    ai_model: result.model,
    meta: {
      weeklyThemes: parsed.weeklyThemes,
      postIdeas: parsed.postIdeas,
      contentFormats: parsed.contentFormats,
      repurposingIdeas: parsed.repurposingIdeas,
      growthPriorities: parsed.growthPriorities,
      thirtyDayFocus: parsed.thirtyDayFocus,
    },
  };

  const { data: saved, error: saveError } = await supabase
    .from("architecta_content_strategies")
    .insert(insertRow)
    .select("*")
    .single();

  if (saveError) return apiError("server_error", saveError.message);

  return apiOk({
    strategy: toCamel(saved as StrategyRow),
    generated: parsed,
  });
}
