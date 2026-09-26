import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route test for /api/posts. We mock the auth + Supabase + gateway boundaries
 * and assert the behaviours the audit flagged: auth gating, validation,
 * rate-limit gating, user-scoped queries, and ownership-stamped inserts.
 */

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceAiUsage: vi.fn(),
  runGateway: vi.fn(),
  parsePostResponse: vi.fn(),
  buildPostUserPrompt: vi.fn(() => "PROMPT"),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUser: h.getAuthenticatedUser,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceAiUsage: h.enforceAiUsage,
  RATE_LIMITS: { postGenerate: { action: "posts.generate", limit: 20, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/llm/prompts/post", () => ({
  buildPostUserPrompt: h.buildPostUserPrompt,
  parsePostResponse: h.parsePostResponse,
}));

import { GET, POST } from "./route";

const USER_ID = "user-abc";

/**
 * Chainable Supabase query-builder stub.
 * `limit()` returns a thenable terminal (so GET can `await` it) that also
 * exposes maybeSingle/single (so `.limit(1).maybeSingle()` chains work). The
 * builder itself is intentionally NOT thenable so the createSupabaseServerClient
 * mock doesn't get auto-unwrapped by `await`.
 */
function makeBuilder(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  let table = "";
  const insertSpy = vi.fn();
  const result = () => resultByTable[table] ?? { data: null, error: null };
  // `current` tracks which chain link `eq()` should return: the builder itself
  // before `limit()`, or the (still-chainable, thenable) terminal after it —
  // mirrors real Postgrest filter builders, which stay chainable post-limit.
  let current: unknown;
  const eq = vi.fn(() => current);
  const terminal = {
    eq,
    maybeSingle: () => Promise.resolve(result()),
    single: () => Promise.resolve(result()),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(onF, onR),
  };
  const builder = {
    eq,
    insertSpy,
    from(t: string) {
      table = t;
      return builder;
    },
    select() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      current = terminal;
      return terminal;
    },
    insert(rows: unknown) {
      insertSpy(rows);
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(result());
    },
    single() {
      return Promise.resolve(result());
    },
  };
  current = builder;
  return builder;
}

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.buildPostUserPrompt.mockReturnValue("PROMPT");
  h.enforceAiUsage.mockResolvedValue(null); // allowed by default
});

describe("GET /api/posts", () => {
  it("returns 401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(401);
  });

  it("scopes the query to the authenticated user and maps rows to camelCase", async () => {
    const row = {
      id: "p1",
      user_id: USER_ID,
      workspace_id: null,
      campaign_id: null,
      strategy_id: null,
      platform: "linkedin",
      title: "Hello",
      hook: "Hook",
      caption: "Cap",
      body: null,
      hashtags: ["a"],
      cta: null,
      image_prompt: null,
      video_prompt: null,
      image_asset_id: null,
      video_asset_id: null,
      status: "draft",
      scheduled_for: null,
      published_at: null,
      ai_provider: "openai",
      ai_model: "gpt-4o",
      meta: null,
      created_at: "2026-06-23T00:00:00Z",
      updated_at: "2026-06-23T00:00:00Z",
    };
    const builder = makeBuilder({ architecta_posts: { data: [row], error: null } });
    h.createSupabaseServerClient.mockResolvedValue(builder);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });

    const res = await GET(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { posts: Array<{ id: string; imagePrompt: unknown }> } };
    expect(body.ok).toBe(true);
    expect(body.data.posts[0].id).toBe("p1");
    expect(body.data.posts[0]).toHaveProperty("imagePrompt"); // snake -> camel
    expect(builder.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it.each(["publishing", "failed"])(
    "applies the '%s' status filter instead of silently ignoring it",
    async (status) => {
      const builder = makeBuilder({ architecta_posts: { data: [], error: null } });
      h.createSupabaseServerClient.mockResolvedValue(builder);
      h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });

      const res = await GET(new Request(`http://localhost/api/posts?status=${status}`));
      expect(res.status).toBe(200);
      // These are valid lifecycle statuses (added by the publish-reliability
      // migration) but weren't valid client-write values, so the filter must
      // still recognize them rather than dropping the constraint entirely.
      expect(builder.eq).toHaveBeenCalledWith("status", status);
    }
  );
});

describe("POST /api/posts", () => {
  it("returns 401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(jsonReq({ platform: "linkedin", topic: "hi" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited (before any generation)", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.enforceAiUsage.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 429 })
    );

    const res = await POST(jsonReq({ platform: "linkedin", topic: "hi" }));
    expect(res.status).toBe(429);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("returns 422 for an invalid body", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });

    const res = await POST(jsonReq({ platform: "linkedin" })); // missing topic
    expect(res.status).toBe(422);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("generates, stamps user_id on insert, and returns the saved post", async () => {
    const saved = {
      id: "new-post",
      user_id: USER_ID,
      workspace_id: null,
      campaign_id: null,
      strategy_id: null,
      platform: "linkedin",
      title: "Launching",
      hook: "Hook",
      caption: "Caption",
      body: "Body",
      hashtags: ["x"],
      cta: "CTA",
      image_prompt: null,
      video_prompt: null,
      image_asset_id: null,
      video_asset_id: null,
      status: "draft",
      scheduled_for: null,
      published_at: null,
      ai_provider: "openai",
      ai_model: "gpt-4o",
      meta: {},
      created_at: "2026-06-23T00:00:00Z",
      updated_at: "2026-06-23T00:00:00Z",
    };
    const builder = makeBuilder({
      brand_profiles: { data: null, error: null },
      founder_style_profiles: { data: null, error: null },
      architecta_posts: { data: saved, error: null },
    });
    h.createSupabaseServerClient.mockResolvedValue(builder);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.runGateway.mockResolvedValue({ text: "{}", provider: "openai", model: "gpt-4o" });
    h.parsePostResponse.mockReturnValue({
      title: "Launching",
      hook: "Hook",
      caption: "Caption",
      body: "Body",
      hashtags: ["x"],
      cta: "CTA",
      imagePrompt: "",
      videoPrompt: "",
    });

    const res = await POST(jsonReq({ platform: "linkedin", topic: "Launching our feature" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { post: { id: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.post.id).toBe("new-post");

    expect(h.runGateway).toHaveBeenCalledOnce();
    const insertedRow = builder.insertSpy.mock.calls[0][0] as { user_id: string; status: string };
    expect(insertedRow.user_id).toBe(USER_ID);
    expect(insertedRow.status).toBe("draft");
  });
});
