import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  publishPost: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: h.enforceRateLimit,
  RATE_LIMITS: { publish: { action: "posts.publish", limit: 10, windowSeconds: 60 } },
}));
vi.mock("@/lib/publishing/publish", () => ({ publishPost: h.publishPost }));

import { POST } from "./route";

const USER_ID = "user-pub";

function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  function makeQuery(table: string) {
    const result = () => resultByTable[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      maybeSingle: () => Promise.resolve(result()),
      single: () => Promise.resolve(result()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  return { from: (t: string) => makeQuery(t) };
}

function ctx(id = "post-1") {
  return { params: Promise.resolve({ id }) };
}

const LINKEDIN_POST = {
  id: "post-1",
  user_id: USER_ID,
  platform: "linkedin",
  hook: "H",
  caption: "C",
  body: null,
  cta: null,
  hashtags: [],
  image_asset_id: null,
  video_asset_id: null,
  meta: {},
};

const CONNECTION = { id: "conn-1", status: "connected", external_account_id: "member-x" };

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.enforceRateLimit.mockResolvedValue(null);
});

describe("POST /api/posts/[id]/publish", () => {
  it("401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(new Request("http://x"), ctx())).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.enforceRateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(429);
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("404 when the post is not found", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({ architecta_posts: { data: null, error: null } })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    expect((await POST(new Request("http://x"), ctx())).status).toBe(404);
  });

  it("400 when the post's platform isn't connectable", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: { ...LINKEDIN_POST, platform: "blog" }, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(400);
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("404 when no account is connected for the platform", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: LINKEDIN_POST, error: null },
        architecta_platform_connections: { data: null, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(404);
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("publishes when a connected account exists", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: LINKEDIN_POST, error: null },
        architecta_platform_connections: { data: CONNECTION, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.publishPost.mockResolvedValue({
      ok: true,
      externalPostId: "urn:li:share:1",
      externalUrl: "https://linkedin.com/x",
    });

    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { externalPostId: string } };
    expect(body.ok).toBe(true);
    expect(body.data.externalPostId).toBe("urn:li:share:1");
    expect(h.publishPost).toHaveBeenCalledOnce();
    expect(h.publishPost.mock.calls[0][0].trigger).toBe("manual");
  });

  it("502 when the publish itself fails", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: LINKEDIN_POST, error: null },
        architecta_platform_connections: { data: CONNECTION, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.publishPost.mockResolvedValue({ ok: false, error: "LinkedIn post failed" });
    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(502);
  });

  it.each(["publishing", "published"])("409 without publishing when the post is %s", async (status) => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: { ...LINKEDIN_POST, status }, error: null },
        architecta_platform_connections: { data: CONNECTION, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(new Request("http://x"), ctx());
    expect(res.status).toBe(409);
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("returns a recognizable reconnect_required error for an expired connection", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: LINKEDIN_POST, error: null },
        architecta_platform_connections: {
          data: { ...CONNECTION, status: "expired" },
          error: null,
        },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(new Request("http://x"), ctx());
    const body = (await res.json()) as { error: { details: { code: string } } };
    expect(res.status).toBe(400);
    expect(body.error.details.code).toBe("reconnect_required");
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("409 on a lost claim race; passes the failure code through otherwise", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_posts: { data: LINKEDIN_POST, error: null },
        architecta_platform_connections: { data: CONNECTION, error: null },
      })
    );
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.publishPost.mockResolvedValue({
      ok: false,
      error: "already",
      code: "already_publishing",
      retryable: false,
    });
    expect((await POST(new Request("http://x"), ctx())).status).toBe(409);

    h.publishPost.mockResolvedValue({
      ok: false,
      error: "Your LinkedIn connection has expired. Reconnect LinkedIn to continue publishing.",
      code: "reconnect_required",
      retryable: false,
    });
    const res = await POST(new Request("http://x"), ctx());
    const body = (await res.json()) as { error: { details: { code: string } } };
    expect(res.status).toBe(502);
    expect(body.error.details.code).toBe("reconnect_required");
  });
});
