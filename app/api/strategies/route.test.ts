import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  runGateway: vi.fn(),
  parseStrategyResponse: vi.fn(),
  buildStrategyUserPrompt: vi.fn(() => "PROMPT"),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: h.enforceRateLimit,
  RATE_LIMITS: { strategyGenerate: { action: "strategies.generate", limit: 10, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/llm/prompts/strategy", () => ({
  buildStrategyUserPrompt: h.buildStrategyUserPrompt,
  parseStrategyResponse: h.parseStrategyResponse,
}));

import { POST } from "./route";

const USER_ID = "user-strat";

/** Client-shaped mock: from(table) → a chainable AND thenable query. */
function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  const insertCalls: unknown[] = [];
  function makeQuery(table: string) {
    const result = () => resultByTable[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      in: () => q,
      insert: (rows: unknown) => {
        insertCalls.push(rows);
        return q;
      },
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  return { from: (t: string) => makeQuery(t), insertCalls };
}

function req(body: unknown) {
  return new Request("http://localhost/api/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  businessNiche: "SaaS for accountants",
  targetAudience: "Small-firm accountants",
  contentGoals: "Build authority",
  preferredPlatforms: ["linkedin"],
};

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.buildStrategyUserPrompt.mockReturnValue("PROMPT");
  h.enforceRateLimit.mockResolvedValue(null);
});

describe("POST /api/strategies", () => {
  it("401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(req(VALID))).status).toBe(401);
  });

  it("429 when rate limited, before generation", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.enforceRateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    const res = await POST(req(VALID));
    expect(res.status).toBe(429);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("422 for invalid body", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(req({ targetAudience: "x" })); // missing businessNiche
    expect(res.status).toBe(422);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("generates and stamps user_id on insert", async () => {
    const saved = {
      id: "strat-1",
      kind: "content_strategy",
      title: null,
      summary: "S",
      pillars: [],
      audience_angles: [],
      content_themes: [],
      posting_cadence: [],
      quick_wins: [],
      next_actions: [],
      campaigns_seed: [],
      platform_strategy: {},
      source_input: {},
      status: "draft",
      ai_provider: "anthropic",
      ai_model: "claude-sonnet-4-6",
      meta: {},
      created_at: "2026-06-23T00:00:00Z",
      updated_at: "2026-06-23T00:00:00Z",
    };
    const supabase = makeSupabase({
      architecta_content_strategies: { data: saved, error: null },
    });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.runGateway.mockResolvedValue({ text: "{}", provider: "anthropic", model: "claude-sonnet-4-6" });
    h.parseStrategyResponse.mockReturnValue({
      summary: "S",
      contentPillars: [],
      audienceAngles: [],
      contentThemes: [],
      postingCadence: [],
      quickWins: [],
      nextActions: [],
      postIdeas: [],
      weeklyThemes: [],
      contentFormats: [],
      repurposingIdeas: [],
      growthPriorities: [],
      thirtyDayFocus: [],
    });

    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { strategy: { id: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.strategy.id).toBe("strat-1");

    const inserted = supabase.insertCalls[0] as { user_id: string; status: string };
    expect(inserted.user_id).toBe(USER_ID);
    expect(inserted.status).toBe("draft");
  });
});
