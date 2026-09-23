import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ publish: vi.fn() }));

vi.mock("./registry", () => ({ getAdapter: () => ({ publish: h.publish }) }));
vi.mock("./connections", () => ({
  CONNECTIONS_TABLE: "architecta_platform_connections",
  getDecryptedTokens: () => ({ accessToken: "tok", refreshToken: null }),
}));

import { PublishAuthError, PublishHttpError } from "./adapters/types";
import type { ConnectionRow } from "./connections";
import {
  claimPost,
  MAX_PUBLISH_ATTEMPTS,
  publishPost,
  sweepStalePublishing,
  type PostForPublish,
} from "./publish";

type Row = Record<string, unknown>;

/**
 * Minimal in-memory Supabase fake with conditional UPDATE … WHERE … RETURNING
 * semantics, so claim races behave like the real database.
 * `failWhen(table, op, values)` injects a database error.
 */
function makeDb(
  posts: Row[],
  failWhen: (table: string, op: string, values: Row) => boolean = () => false
) {
  const tables: Record<string, Row[]> = {
    architecta_posts: posts,
    architecta_platform_connections: [{ id: "conn-1", status: "connected" }],
    architecta_content_calendar_items: [],
    architecta_publish_log: [],
  };
  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let op: "select" | "update" | "insert" = "select";
    let values: Row = {};
    const q: Record<string, unknown> = {};
    const run = () => {
      if (failWhen(table, op, values)) {
        return { data: null, error: { message: "db down" } };
      }
      if (op === "insert") {
        tables[table].push(values);
        return { data: null, error: null };
      }
      const matched = tables[table].filter((r) => filters.every((f) => f(r)));
      if (op === "update") matched.forEach((r) => Object.assign(r, values));
      return { data: matched.map((r) => ({ id: r.id })), error: null };
    };
    Object.assign(q, {
      select: () => q,
      update: (v: Row) => {
        op = "update";
        values = v;
        return q;
      },
      insert: (v: Row) => {
        op = "insert";
        values = v;
        return q;
      },
      eq: (c: string, v: unknown) => {
        filters.push((r) => r[c] === v);
        return q;
      },
      in: (c: string, vs: unknown[]) => {
        filters.push((r) => vs.includes(r[c]));
        return q;
      },
      lt: (c: string, v: string) => {
        filters.push((r) => String(r[c]) < v);
        return q;
      },
      then: (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(f, r),
    });
    return q;
  }
  return { client: { from } as never, tables };
}

const basePost = (over: Row = {}): Row => ({
  id: "post-1",
  user_id: "user-1",
  platform: "linkedin",
  hook: "H",
  caption: "C",
  status: "scheduled",
  publish_attempts: 0,
  meta: {},
  ...over,
});
const asPost = (r: Row) => r as unknown as PostForPublish;
const conn = (over: Partial<ConnectionRow> = {}) =>
  ({
    id: "conn-1",
    platform: "linkedin",
    status: "connected",
    external_account_id: "member",
    expires_at: null,
    ...over,
  }) as ConnectionRow;

const ok = { externalPostId: "urn:li:share:1", externalUrl: "https://x" };

beforeEach(() => {
  h.publish.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("claimPost", () => {
  it("claims a scheduled post exactly once", async () => {
    const db = makeDb([basePost()]);
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(true);
    expect(db.tables.architecta_posts[0].status).toBe("publishing");
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(false);
  });

  it.each(["publishing", "published"])("cannot claim a %s post (manual or cron)", async (status) => {
    const db = makeDb([basePost({ status })]);
    expect(await claimPost(db.client, asPost(basePost()), "manual")).toBe(false);
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(false);
  });

  it("cron never claims a failed post; manual retry can", async () => {
    const db = makeDb([basePost({ status: "failed" })]);
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(false);
    expect(await claimPost(db.client, asPost(basePost()), "manual")).toBe(true);
  });

  it("throws (not silently false) when the claim write errors", async () => {
    const db = makeDb([basePost()], () => true);
    await expect(claimPost(db.client, asPost(basePost()), "scheduled")).rejects.toThrow(/claim/i);
  });
});

describe("publishPost", () => {
  it("publishes and records success", async () => {
    h.publish.mockResolvedValue(ok);
    const db = makeDb([basePost()]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    expect(out).toMatchObject({ ok: true, recorded: true });
    expect(db.tables.architecta_posts[0]).toMatchObject({ status: "published" });
    expect(db.tables.architecta_publish_log[0]).toMatchObject({ status: "success" });
  });

  it("concurrent cron + Publish Now attempts produce a single adapter call", async () => {
    h.publish.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return ok;
    });
    const db = makeDb([basePost()]);
    const run = (trigger: "manual" | "scheduled") =>
      publishPost({ supabase: db.client, post: asPost(basePost()), connection: conn(), trigger });
    const results = await Promise.all([run("scheduled"), run("manual"), run("scheduled")]);
    expect(h.publish).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.code === "already_publishing")).toHaveLength(2);
  });

  it("refuses to republish a published post", async () => {
    const db = makeDb([basePost({ status: "published" })]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "manual",
    });
    expect(out).toMatchObject({ ok: false, code: "already_publishing" });
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("retryable scheduled failures return to scheduled, then fail at the attempt cap", async () => {
    h.publish.mockRejectedValue(new PublishHttpError("LinkedIn post failed (503)", 503));
    const db = makeDb([basePost()]);
    const attempt = () =>
      publishPost({
        supabase: db.client,
        post: asPost({
          ...basePost(),
          publish_attempts: db.tables.architecta_posts[0].publish_attempts,
        }),
        connection: conn(),
        trigger: "scheduled",
      });

    for (let i = 1; i < MAX_PUBLISH_ATTEMPTS; i++) {
      const out = await attempt();
      expect(out).toMatchObject({ ok: false, retryable: true });
      expect(db.tables.architecta_posts[0].status).toBe("scheduled");
      expect(db.tables.architecta_posts[0].publish_attempts).toBe(i);
    }
    const last = await attempt();
    expect(last).toMatchObject({ ok: false, retryable: false });
    expect(db.tables.architecta_posts[0].status).toBe("failed");
    expect(h.publish).toHaveBeenCalledTimes(MAX_PUBLISH_ATTEMPTS);
    // Failed posts are no longer claimable by cron: no infinite retry.
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(false);
    expect(db.tables.architecta_publish_log).toHaveLength(MAX_PUBLISH_ATTEMPTS);
  });

  it("non-retryable failures fail immediately with a user-safe message", async () => {
    h.publish.mockRejectedValue(
      new PublishHttpError('LinkedIn post failed (422): {"detail":"internal"}', 422)
    );
    const db = makeDb([basePost()]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    expect(out.ok).toBe(false);
    const post = db.tables.architecta_posts[0];
    expect(post.status).toBe("failed");
    expect(post.publish_error).not.toContain("internal");
    expect(post.publish_error).not.toContain("422");
    // The raw detail is kept in the internal log only.
    expect(db.tables.architecta_publish_log[0].error).toContain("422");
  });

  it("manual failures are not auto-retried", async () => {
    h.publish.mockRejectedValue(new PublishHttpError("busy (503)", 503));
    const db = makeDb([basePost({ status: "draft" })]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost({ status: "draft" })),
      connection: conn(),
      trigger: "manual",
    });
    expect(out).toMatchObject({ ok: false, retryable: false });
    expect(db.tables.architecta_posts[0].status).toBe("failed");
  });

  it("does not call the adapter for an expired connection and flags reconnect", async () => {
    const db = makeDb([basePost()]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn({ expires_at: new Date(Date.now() - 1000).toISOString() }),
      trigger: "scheduled",
    });
    expect(h.publish).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      ok: false,
      code: "reconnect_required",
      error: "Your LinkedIn connection has expired. Reconnect LinkedIn to continue publishing.",
    });
    expect(db.tables.architecta_platform_connections[0].status).toBe("expired");
    expect(db.tables.architecta_posts[0]).toMatchObject({
      status: "failed",
      publish_error_code: "reconnect_required",
    });
  });

  it("does not call the adapter when there is no connection", async () => {
    const db = makeDb([basePost()]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: null,
      trigger: "scheduled",
    });
    expect(h.publish).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, code: "not_connected" });
  });

  it.each(["linkedin", "threads"])(
    "an auth failure from %s expires the connection and asks to reconnect",
    async (platform) => {
      h.publish.mockRejectedValue(new PublishAuthError(platform));
      const db = makeDb([basePost({ platform })]);
      const out = await publishPost({
        supabase: db.client,
        post: asPost(basePost({ platform })),
        connection: conn({ platform }),
        trigger: "scheduled",
      });
      expect(out).toMatchObject({ ok: false, code: "reconnect_required", retryable: false });
      expect(db.tables.architecta_platform_connections[0].status).toBe("expired");
      expect(db.tables.architecta_posts[0].status).toBe("failed");
    }
  );

  it("a claim database error aborts before any platform call", async () => {
    const db = makeDb([basePost()], (t, op) => t === "architecta_posts" && op === "update");
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    expect(out.ok).toBe(false);
    expect(h.publish).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("a bare network failure (TypeError) is outcome_unknown, not auto-retried", async () => {
    // fetch() rejects with TypeError both when a request never left the client
    // and when its response was lost after the platform accepted it — the two
    // are indistinguishable, so this must never be treated as safe to retry.
    h.publish.mockRejectedValue(new TypeError("fetch failed"));
    const db = makeDb([basePost()]);
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    expect(out).toMatchObject({ ok: false, code: "outcome_unknown", retryable: false });
    expect(db.tables.architecta_posts[0]).toMatchObject({
      status: "failed",
      publish_error_code: "outcome_unknown",
    });
    // Not returned to `scheduled`: cron must not re-send it automatically.
    expect(db.tables.architecta_posts[0].status).not.toBe("scheduled");
  });

  it("a zombie worker's late completion cannot overwrite a post reclaimed after a stale sweep", async () => {
    const db = makeDb([basePost()]);
    h.publish.mockImplementation(async () => {
      // While this worker's platform call is in flight, simulate the stale
      // sweep failing the post as outcome_unknown and a user manually
      // retrying it — a fresh claim now owns the row.
      db.tables.architecta_posts[0].status = "failed";
      await claimPost(
        db.client,
        asPost(db.tables.architecta_posts[0]),
        "manual",
        "2099-01-01T00:00:00.000Z"
      );
      return ok;
    });
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    // The original worker's success write must not match the reclaimed row.
    expect(out).toMatchObject({ ok: true, recorded: false });
    expect(db.tables.architecta_posts[0].status).toBe("publishing");
    expect(db.tables.architecta_posts[0].meta).toEqual({});
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("published_but_not_recorded")
    );
  });

  it("reports recorded:false, logs it, and never re-sends when the success write fails", async () => {
    let published = false;
    h.publish.mockImplementation(async () => {
      published = true;
      return ok;
    });
    // Claim succeeds; the write after the platform call fails.
    const db = makeDb(
      [basePost()],
      (t, op, v) => t === "architecta_posts" && op === "update" && published && v.status === "published"
    );
    const out = await publishPost({
      supabase: db.client,
      post: asPost(basePost()),
      connection: conn(),
      trigger: "scheduled",
    });
    expect(out).toMatchObject({ ok: true, recorded: false });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("published_but_not_recorded"));
    expect(db.tables.architecta_publish_log[0].meta).toMatchObject({
      post_state_not_recorded: true,
    });
    // Row stays `publishing`, which cron never selects again: no second send.
    expect(db.tables.architecta_posts[0].status).toBe("publishing");
    expect(await claimPost(db.client, asPost(basePost()), "scheduled")).toBe(false);
    expect(h.publish).toHaveBeenCalledTimes(1);
  });
});

describe("sweepStalePublishing", () => {
  it("fails only long-stuck publishing posts, without retrying them", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();
    const db = makeDb([
      basePost({ id: "old", status: "publishing", publish_claimed_at: old }),
      basePost({ id: "new", status: "publishing", publish_claimed_at: fresh }),
    ]);
    expect(await sweepStalePublishing(db.client)).toBe(1);
    const [oldRow, newRow] = db.tables.architecta_posts;
    expect(oldRow).toMatchObject({ status: "failed", publish_error_code: "outcome_unknown" });
    expect(newRow.status).toBe("publishing");
  });
});
