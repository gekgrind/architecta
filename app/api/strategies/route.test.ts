import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceAiUsage: vi.fn(),
  runGateway: vi.fn(),
  parseStrategyResponse: vi.fn(),
  buildStrategyUserPrompt: vi.fn(() => "PROMPT"),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceAiUsage: h.enforceAiUsage,
  RATE_LIMITS: { strategyGenerate: { action: "strategies.generate", limit: 10, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/llm/prompts/strategy", () => ({
  buildStrategyUserPrompt: h.buildStrategyUserPrompt,
  parseStrategyResponse: h.parseStrategyResponse,
}));

import { makeFakeSupabase } from "@/test/fake-supabase";

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
  h.enforceAiUsage.mockResolvedValue(null);
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
    h.enforceAiUsage.mockResolvedValue(new Response("{}", { status: 429 }));
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

function parsedOutput(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Own the seed-stage B2B brand sprint category with proof-led content.",
    contentPillars: [
      { title: "Proof of speed", description: "Show the two-week sprint.", items: ["Sprint teardown"] },
      { title: "Untitled pillar", description: undefined, items: ["orphaned"] },
    ],
    audienceAngles: [],
    contentThemes: [],
    postingCadence: [],
    quickWins: [],
    nextActions: ["Publish a teardown"],
    postIdeas: [],
    weeklyThemes: [],
    contentFormats: [],
    repurposingIdeas: [],
    growthPriorities: ["Clarify the offer"],
    thirtyDayFocus: ["Week 1: case study"],
    ...overrides,
  };
}

describe("POST /api/strategies — business strategy integrity", () => {
  const STRATEGIES = "architecta_content_strategies";

  function setup(existing: Record<string, unknown>[] = [], failWhen?: Parameters<typeof makeFakeSupabase>[1]) {
    const fake = makeFakeSupabase({ [STRATEGIES]: existing }, failWhen);
    h.createSupabaseServerClient.mockResolvedValue(fake.client);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.runGateway.mockResolvedValue({ text: "{}", provider: "anthropic", model: "claude-sonnet" });
    return fake;
  }

  async function post(kind: string) {
    const res = await POST(req({ ...VALID, kind }));
    return { res, body: (await res.json()) as { ok: boolean; data?: { strategy: Record<string, unknown> }; error?: { message: string } } };
  }

  it("activates the first Strategy Engine strategy and persists pillar ids", async () => {
    const fake = setup();
    h.parseStrategyResponse.mockReturnValue(parsedOutput());

    const { res, body } = await post("strategy_engine");
    expect(res.status).toBe(200);
    expect(body.data?.strategy).toMatchObject({ kind: "strategy_engine", status: "active", nextActions: ["Publish a teardown"] });

    const [row] = fake.tables[STRATEGIES];
    expect(row.status).toBe("active");
    // Only usable pillars are saved — the parser's placeholder-titled pillar is dropped.
    const pillars = row.pillars as Array<{ id: string; title: string }>;
    expect(pillars).toHaveLength(1);
    expect(pillars[0].title).toBe("Proof of speed");
    expect(pillars[0].id).toMatch(/^[0-9a-f-]{36}$/);
    // The response is the saved record, with the persisted pillar id.
    expect((body.data?.strategy.pillars as Array<{ id: string }>)[0].id).toBe(pillars[0].id);
  });

  it("saves a later Strategy Engine strategy as a draft", async () => {
    const fake = setup([
      { id: "existing", user_id: USER_ID, kind: "strategy_engine", status: "active", created_at: "2026-09-01T00:00:00.000Z" },
    ]);
    h.parseStrategyResponse.mockReturnValue(parsedOutput());

    const { body } = await post("strategy_engine");
    expect(body.data?.strategy.status).toBe("draft");
    expect(fake.tables[STRATEGIES].filter((r) => r.status === "active").map((r) => r.id)).toEqual(["existing"]);
  });

  it("ignores another user's active strategy when deciding the first one", async () => {
    setup([{ id: "theirs", user_id: "someone-else", kind: "strategy_engine", status: "active", created_at: "2026-09-01T00:00:00.000Z" }]);
    h.parseStrategyResponse.mockReturnValue(parsedOutput());
    expect((await post("strategy_engine")).body.data?.strategy.status).toBe("active");
  });

  it("ignores active content plans when deciding the first business strategy", async () => {
    setup([{ id: "cs", user_id: USER_ID, kind: "content_strategy", status: "active", created_at: "2026-09-01T00:00:00.000Z" }]);
    h.parseStrategyResponse.mockReturnValue(parsedOutput());
    expect((await post("strategy_engine")).body.data?.strategy.status).toBe("active");
  });

  it.each(["content_strategy", "content_architect"])("never auto-activates %s", async (kind) => {
    const fake = setup();
    h.parseStrategyResponse.mockReturnValue(parsedOutput());
    const { body } = await post(kind);
    expect(body.data?.strategy).toMatchObject({ kind, status: "draft" });
    expect(fake.tables[STRATEGIES][0].status).toBe("draft");
  });

  it("demotes itself when a concurrent first strategy was activated earlier", async () => {
    const fake = setup();
    h.parseStrategyResponse.mockReturnValue(parsedOutput());
    // Simulate a concurrent request activating its strategy between this
    // request's active-strategy lookup and its insert.
    const from = (fake.client as { from: (t: string) => Record<string, unknown> }).from;
    let injected = false;
    (fake.client as { from: unknown }).from = (table: string) => {
      const q = from(table);
      const insert = q.insert as (v: Record<string, unknown>) => unknown;
      q.insert = (values: Record<string, unknown>) => {
        if (!injected) {
          injected = true;
          fake.tables[STRATEGIES].push({ id: "concurrent", user_id: USER_ID, kind: "strategy_engine", status: "active", created_at: "2000-01-01T00:00:00.000Z" });
        }
        return insert(values);
      };
      return q;
    };

    const { body } = await post("strategy_engine");
    expect(body.data?.strategy.status).toBe("draft");
    expect(fake.tables[STRATEGIES].filter((r) => r.status === "active").map((r) => r.id)).toEqual(["concurrent"]);
  });

  it("saves a draft when the active-strategy lookup fails", async () => {
    let selects = 0;
    const fake = setup([], (_table, op) => op === "select" && selects++ === 0);
    h.parseStrategyResponse.mockReturnValue(parsedOutput());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { body } = await post("strategy_engine");
    expect(body.data?.strategy.status).toBe("draft");
    expect(fake.tables[STRATEGIES][0].status).toBe("draft");
    warn.mockRestore();
  });

  it.each([
    ["empty output", { summary: "", contentPillars: [] }],
    ["missing summary", { summary: "   " }],
    ["no pillars", { contentPillars: [] }],
    ["only placeholder-titled pillars", { contentPillars: [{ title: "Untitled pillar", items: ["x"] }] }],
    ["pillars without content", { contentPillars: [{ title: "Empty", description: "", items: [] }] }],
  ])("rejects %s without saving a row", async (_label, overrides) => {
    const fake = setup();
    h.parseStrategyResponse.mockReturnValue(parsedOutput(overrides));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { res, body } = await post("strategy_engine");
    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/incomplete strategy/);
    expect(fake.tables[STRATEGIES]).toHaveLength(0);
    expect(fake.log.some((entry) => entry.op === "insert")).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
