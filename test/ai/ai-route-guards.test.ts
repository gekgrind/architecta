import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server-side AI limits on routes that previously had none: post revise and
 * the Studio endpoints. Auth, Supabase, limiter and gateway are mocked.
 */

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceAiUsage: vi.fn(),
  runGateway: vi.fn(),
  getMemoryForGeneration: vi.fn(),
  aggregateMemory: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceAiUsage: h.enforceAiUsage,
  RATE_LIMITS: {
    postRevise: { action: "posts.revise", limit: 10, windowSeconds: 60 },
    studioGenerate: { action: "studio.generate", limit: 20, windowSeconds: 60 },
    studioRefine: { action: "studio.refine", limit: 20, windowSeconds: 60 },
    studioLearn: { action: "studio.learn", limit: 4, windowSeconds: 60 },
  },
}));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/getMemoryForGeneration", () => ({
  getMemoryForGeneration: h.getMemoryForGeneration,
}));
vi.mock("@/lib/ai/memoryAggregator", () => ({ aggregateMemory: h.aggregateMemory }));

import { POST as revise } from "@/app/api/posts/[id]/revise/route";
import { POST as studioGenerate } from "@/app/api/studio/generate/route";
import { POST as studioLearn } from "@/app/api/studio/learn/route";
import { POST as studioRefine } from "@/app/api/studio/refine/route";

const USER_ID = "user-guard";
const POST_ID = "11111111-1111-4111-8111-111111111111";

function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }> = {}) {
  function query(table: string) {
    const result = () => resultByTable[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      insert: () => q,
      update: () => q,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  return { from: (t: string) => query(t) };
}

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const limited = () => new Response(JSON.stringify({ ok: false }), { status: 429 });

const gatewayResult = {
  provider: "nvidia",
  model: "z-ai/glm-5.3",
  text: "generated text",
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
};

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset());
  h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
  h.enforceAiUsage.mockResolvedValue(null);
  h.runGateway.mockResolvedValue(gatewayResult);
  h.getMemoryForGeneration.mockResolvedValue({ summary: "" });
});

describe("POST /api/posts/[id]/revise", () => {
  const ctx = { params: Promise.resolve({ id: POST_ID }) };
  const body = { tone: "bolder" };

  it("returns 429 and makes no AI call when the AI limit is hit", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.enforceAiUsage.mockResolvedValue(limited());

    const res = await revise(jsonReq(`http://x/api/posts/${POST_ID}/revise`, body), ctx);

    expect(res.status).toBe(429);
    expect(h.enforceAiUsage).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ action: "posts.revise" }));
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("checks the limit for the authenticated user before calling the gateway", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: { id: POST_ID, platform: "linkedin", caption: "draft" }, error: null },
      })
    );

    await revise(jsonReq(`http://x/api/posts/${POST_ID}/revise`, body), ctx);

    expect(h.enforceAiUsage).toHaveBeenCalledTimes(1);
    expect(h.runGateway).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, task: "POST_REVISION" })
    );
  });

  it("skips the limiter for unauthenticated callers (401 first)", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.getAuthenticatedUser.mockResolvedValue(null);
    const res = await revise(jsonReq(`http://x/api/posts/${POST_ID}/revise`, body), ctx);
    expect(res.status).toBe(401);
    expect(h.enforceAiUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/studio/generate", () => {
  const body = { gen: { platform: "linkedin", idea: "launch" } };

  it("returns 429 and makes no AI call when the AI limit is hit", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.enforceAiUsage.mockResolvedValue(limited());

    const res = await studioGenerate(jsonReq("http://x/api/studio/generate", body));

    expect(res.status).toBe(429);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("goes through the gateway (server-chosen provider/model), not a direct OpenAI client", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());

    const res = await studioGenerate(jsonReq("http://x/api/studio/generate", body));

    expect(res.status).toBe(200);
    const call = h.runGateway.mock.calls[0][0];
    expect(call).toMatchObject({ userId: USER_ID, task: "POST_GENERATION", tier: "draft" });
    expect(call).not.toHaveProperty("preference");
    expect(call).not.toHaveProperty("maxTokens");
    const json = (await res.json()) as { data: { generation: { provider: string; model: string } } };
    expect(json.data.generation).toMatchObject({ provider: "nvidia", model: "z-ai/glm-5.3" });
  });
});

describe("POST /api/studio/refine", () => {
  const body = {
    platform: "linkedin",
    draft: "hello",
    revision: { tone: "bolder", length: "same", ctaStrength: "same" },
  };

  it("returns 429 and makes no AI call when the AI limit is hit", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.enforceAiUsage.mockResolvedValue(limited());

    const res = await studioRefine(jsonReq("http://x/api/studio/refine", body));

    expect(res.status).toBe(429);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("refines through the gateway", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());

    const res = await studioRefine(jsonReq("http://x/api/studio/refine", body));

    expect(res.status).toBe(200);
    expect(h.runGateway).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, task: "POST_REVISION", tier: "draft" })
    );
  });
});

describe("POST /api/studio/learn", () => {
  it("returns 429 and makes no AI call when the AI limit is hit", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.aggregateMemory.mockReturnValue([{ summary: "prefers short posts" }]);
    h.enforceAiUsage.mockResolvedValue(limited());

    const res = await studioLearn(jsonReq("http://x/api/studio/learn", {}));

    expect(res.status).toBe(429);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("does not consume AI limits when there is nothing to learn", async () => {
    h.createSupabaseServerClient.mockResolvedValue(makeSupabase());
    h.aggregateMemory.mockReturnValue([]);

    const res = await studioLearn(jsonReq("http://x/api/studio/learn", {}));

    expect(res.status).toBe(200);
    expect(h.enforceAiUsage).not.toHaveBeenCalled();
    expect(h.runGateway).not.toHaveBeenCalled();
  });
});
