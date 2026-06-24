import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  runGateway: vi.fn(),
  parseCampaignResponse: vi.fn(),
  buildCampaignUserPrompt: vi.fn(() => "PROMPT"),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: h.enforceRateLimit,
  RATE_LIMITS: { campaignGenerate: { action: "campaigns.generate", limit: 4, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/llm/prompts/campaign", () => ({
  buildCampaignUserPrompt: h.buildCampaignUserPrompt,
  parseCampaignResponse: h.parseCampaignResponse,
}));

import { POST } from "./route";

const USER_ID = "user-camp";

function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  const insertCalls: Array<{ table: string; rows: unknown }> = [];
  let lastTable = "";
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
        insertCalls.push({ table, rows });
        return q;
      },
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  return {
    from: (t: string) => {
      lastTable = t;
      return makeQuery(t);
    },
    insertCalls,
    get lastTable() {
      return lastTable;
    },
  };
}

function req(body: unknown) {
  return new Request("http://localhost/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  name: "Spring launch",
  theme: "Renewal",
  goal: "Drive signups",
  platforms: ["linkedin", "instagram"],
};

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.buildCampaignUserPrompt.mockReturnValue("PROMPT");
  h.enforceRateLimit.mockResolvedValue(null);
});

describe("POST /api/campaigns", () => {
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

  it("422 for invalid body (no platforms)", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(req({ ...VALID, platforms: [] }));
    expect(res.status).toBe(422);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("creates a campaign and fans out child posts under it", async () => {
    const savedCampaign = {
      id: "camp-1",
      user_id: USER_ID,
      workspace_id: null,
      strategy_id: null,
      name: "Spring launch",
      theme: "Renewal",
      goal: "Drive signups",
      launch_date: null,
      status: "planning",
      meta: {},
      created_at: "2026-06-23T00:00:00Z",
      updated_at: "2026-06-23T00:00:00Z",
    };
    const supabase = makeSupabase({
      brand_profiles: { data: null, error: null },
      founder_style_profiles: { data: null, error: null },
      architecta_campaigns: { data: savedCampaign, error: null },
      architecta_posts: { data: [{ id: "p1" }], error: null },
    });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.runGateway.mockResolvedValue({ text: "{}", provider: "anthropic", model: "claude-sonnet-4-6" });
    h.parseCampaignResponse.mockReturnValue({
      summary: "Sum",
      launchSequence: [],
      promotionalAngles: [],
      repurposingIdeas: [],
      posts: [
        {
          platform: "linkedin",
          title: "P",
          hook: "H",
          caption: "C",
          body: "B",
          hashtags: ["x"],
          cta: "CTA",
          imagePrompt: "",
          videoPrompt: "",
        },
        {
          platform: "instagram",
          title: "P2",
          hook: "H2",
          caption: "C2",
          body: "B2",
          hashtags: [],
          cta: "",
          imagePrompt: "",
          videoPrompt: "",
        },
        {
          // Off-target platform — must be filtered out of the fan-out.
          platform: "tiktok",
          title: "P3",
          hook: "",
          caption: "",
          body: "",
          hashtags: [],
          cta: "",
          imagePrompt: "",
          videoPrompt: "",
        },
      ],
    });

    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { campaign: { id: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.campaign.id).toBe("camp-1");

    const campaignInsert = supabase.insertCalls.find((c) => c.table === "architecta_campaigns");
    expect((campaignInsert?.rows as { user_id: string }).user_id).toBe(USER_ID);

    const postsInsert = supabase.insertCalls.find((c) => c.table === "architecta_posts");
    const rows = postsInsert?.rows as Array<{ platform: string; campaign_id: string }>;
    // tiktok was not in the requested platforms → only linkedin + instagram inserted.
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.campaign_id === "camp-1")).toBe(true);
    expect(rows.map((r) => r.platform).sort()).toEqual(["instagram", "linkedin"]);
  });
});
