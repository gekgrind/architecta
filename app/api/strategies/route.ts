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
import {
  BUSINESS_STRATEGY_KINDS,
  generatedStrategyIssues,
  isBusinessStrategyKind,
  isUsableGeneratedPillar,
  normalizeStrategyRecord,
  STRATEGY_KINDS,
} from "@/lib/strategy/strategy-record";
import { strategyGenerateInputSchema } from "@/lib/validation/strategy";

export const runtime = "nodejs";

const ALLOWED_KINDS = STRATEGY_KINDS;

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function hasActiveBusinessStrategy(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("architecta_content_strategies")
    .select("id")
    .eq("user_id", userId)
    .in("kind", [...BUSINESS_STRATEGY_KINDS])
    .eq("status", "active")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Two first strategies generated concurrently can both be inserted active.
 * The earliest active one keeps the slot; a later one demotes itself to draft.
 * Returns the row's final status.
 */
async function settleAutoActivation(
  supabase: Supabase,
  userId: string,
  saved: { id: string; created_at: string }
): Promise<"active" | "draft"> {
  const { data } = await supabase
    .from("architecta_content_strategies")
    .select("id, created_at")
    .eq("user_id", userId)
    .in("kind", [...BUSINESS_STRATEGY_KINDS])
    .eq("status", "active");
  const actives = (data ?? []) as Array<{ id: string; created_at: string }>;
  const earliest = [...actives].sort((a, b) =>
    a.created_at !== b.created_at ? (a.created_at < b.created_at ? -1 : 1) : a.id < b.id ? -1 : 1
  )[0];
  if (!earliest || earliest.id === saved.id) return "active";

  const { error } = await supabase
    .from("architecta_content_strategies")
    .update({ status: "draft" })
    .eq("user_id", userId)
    .eq("id", saved.id);
  return error ? "active" : "draft";
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
    strategies: (data ?? []).map(normalizeStrategyRecord),
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

  // Business strategies (the Strategy Engine) must be substantive before they
  // are saved: nothing is persisted, and nothing is invented, when the model
  // returns an unusable result.
  const isBusinessStrategy = isBusinessStrategyKind(kind);
  let pillars: unknown[] = parsed.contentPillars;
  let status: "active" | "draft" = "draft";
  if (isBusinessStrategy) {
    const issues = generatedStrategyIssues(parsed);
    if (issues.length) {
      console.warn("[strategies] rejected incomplete generated strategy", {
        kind,
        issues,
        provider: result.provider,
        model: result.model,
        pillarCount: parsed.contentPillars.length,
        summaryLength: parsed.summary.trim().length,
      });
      return apiError(
        "upstream_error",
        "The AI returned an incomplete strategy, so nothing was saved. Try generating again.",
        { details: { issues } }
      );
    }
    pillars = parsed.contentPillars
      .filter(isUsableGeneratedPillar)
      .map((pillar) => ({ id: crypto.randomUUID(), ...pillar }));

    // The first business strategy becomes the current one; later ones stay
    // drafts until explicitly activated. When the lookup fails, save a draft
    // rather than risk a second active strategy.
    try {
      status = (await hasActiveBusinessStrategy(supabase, session.user.id)) ? "draft" : "active";
    } catch (err) {
      console.warn("[strategies] active strategy lookup failed; saving as draft", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
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
    pillars,
    audience_angles: parsed.audienceAngles,
    content_themes: parsed.contentThemes,
    posting_cadence: parsed.postingCadence,
    quick_wins: parsed.quickWins,
    next_actions: parsed.nextActions,
    campaigns_seed: parsed.postIdeas,
    platform_strategy: { preferredPlatforms: input.preferredPlatforms },
    source_input: input,
    status,
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

  const savedRow = saved as { id: string; created_at: string; status: string };
  if (status === "active") {
    savedRow.status = await settleAutoActivation(supabase, session.user.id, savedRow);
  }

  return apiOk({
    strategy: normalizeStrategyRecord(savedRow),
    generated: parsed,
  });
}
