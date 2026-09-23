import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  publishPost: vi.fn(),
  sweepStalePublishing: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: h.createSupabaseServiceClient,
}));
vi.mock("@/lib/publishing/publish", () => ({
  publishPost: h.publishPost,
  sweepStalePublishing: h.sweepStalePublishing,
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";

function makeSupabase(opts: {
  duePosts: unknown[];
  connectionByUser?: { data: unknown; error: unknown };
}) {
  function makeQuery(table: string) {
    if (table === "architecta_platform_connections") {
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        maybeSingle: () =>
          Promise.resolve(opts.connectionByUser ?? { data: null, error: null }),
      });
      return q;
    }
    // architecta_posts due-list query (awaited directly)
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      lte: () => q,
      order: () => q,
      limit: () => q,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve({ data: opts.duePosts, error: null }).then(onF, onR),
    });
    return q;
  }
  return { from: (t: string) => makeQuery(t) };
}

function req(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/publish", { method: "POST", headers });
}

const DUE_LINKEDIN = {
  id: "post-1",
  user_id: "user-1",
  platform: "linkedin",
  hook: "H",
  caption: "C",
};

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  process.env.CRON_SECRET = SECRET;
  h.sweepStalePublishing.mockResolvedValue(0);
});

describe("POST /api/cron/publish", () => {
  it("401 with no Authorization header", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(makeSupabase({ duePosts: [] }));
    expect((await POST(req())).status).toBe(401);
  });

  it("401 with the wrong secret", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(makeSupabase({ duePosts: [] }));
    expect((await POST(req("wrong"))).status).toBe(401);
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("publishes a due post that has a connected account", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(
      makeSupabase({
        duePosts: [DUE_LINKEDIN],
        connectionByUser: { data: { status: "connected", external_account_id: "m" }, error: null },
      })
    );
    h.publishPost.mockResolvedValue({ ok: true, externalPostId: "x", externalUrl: null });

    const res = await POST(req(SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { published: number; failed: number; skipped: number };
    };
    expect(body.data.published).toBe(1);
    expect(body.data.skipped).toBe(0);
    expect(h.publishPost.mock.calls[0][0].trigger).toBe("scheduled");
  });

  it("hands a post with no connection to publishPost so it fails visibly instead of staying scheduled", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(
      makeSupabase({
        duePosts: [DUE_LINKEDIN],
        connectionByUser: { data: null, error: null },
      })
    );
    h.publishPost.mockResolvedValue({
      ok: false,
      error: "Connect your LinkedIn account to publish this post.",
      code: "not_connected",
      retryable: false,
    });
    const res = await POST(req(SECRET));
    const body = (await res.json()) as { data: { failed: number; skipped: number } };
    expect(body.data.failed).toBe(1);
    expect(h.publishPost.mock.calls[0][0].connection).toBeNull();
  });

  it("leaves a post scheduled (does not claim/fail it) when the connection lookup errors", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(
      makeSupabase({
        duePosts: [DUE_LINKEDIN],
        connectionByUser: { data: null, error: { message: "db down" } },
      })
    );
    const res = await POST(req(SECRET));
    const body = (await res.json()) as { data: { failed: number; skipped: number } };
    expect(body.data.skipped).toBe(1);
    expect(body.data.failed).toBe(0);
    // A transient lookup failure must not be treated as "no connection" and
    // must never reach publishPost, which would claim and permanently fail it.
    expect(h.publishPost).not.toHaveBeenCalled();
  });

  it("counts a post already claimed elsewhere as skipped", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(makeSupabase({ duePosts: [DUE_LINKEDIN] }));
    h.publishPost.mockResolvedValue({
      ok: false,
      error: "already",
      code: "already_publishing",
      retryable: false,
    });
    const body = (await (await POST(req(SECRET))).json()) as {
      data: { failed: number; skipped: number };
    };
    expect(body.data).toMatchObject({ failed: 0, skipped: 1 });
  });

  it("sweeps stale publishing posts first", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(makeSupabase({ duePosts: [] }));
    h.sweepStalePublishing.mockResolvedValue(2);
    const body = (await (await POST(req(SECRET))).json()) as { data: { stale: number } };
    expect(h.sweepStalePublishing).toHaveBeenCalledOnce();
    expect(body.data.stale).toBe(2);
  });

  it("skips a due post on a non-connectable platform", async () => {
    h.createSupabaseServiceClient.mockResolvedValue(
      makeSupabase({ duePosts: [{ ...DUE_LINKEDIN, platform: "blog" }] })
    );
    const res = await POST(req(SECRET));
    const body = (await res.json()) as { data: { skipped: number } };
    expect(body.data.skipped).toBe(1);
    expect(h.publishPost).not.toHaveBeenCalled();
  });
});
