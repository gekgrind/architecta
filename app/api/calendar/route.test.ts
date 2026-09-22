import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route test for GET /api/calendar covering the reliability-review finding:
 * a failed linked-post lookup must not be silently treated as "no linked
 * posts" (which would hide publishing/failed state and show a Publish action
 * the server would reject).
 */

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUser: h.getAuthenticatedUser,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));

import { GET } from "./route";

const USER_ID = "user-1";

const CALENDAR_ROW = {
  id: "item-1",
  user_id: USER_ID,
  workspace_id: null,
  post_id: "post-1",
  campaign_id: null,
  scheduled_for: "2026-01-01T00:00:00Z",
  platform: "linkedin",
  status: "scheduled",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  function makeQuery(table: string) {
    const result = () => resultByTable[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      in: () => q,
      gte: () => q,
      lte: () => q,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  return { from: (t: string) => makeQuery(t) };
}

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
});

describe("GET /api/calendar", () => {
  it("returns 401 when unauthenticated", async () => {
    h.getAuthenticatedUser.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/calendar"));
    expect(res.status).toBe(401);
  });

  it("surfaces a server error instead of silently returning null publishing state when the linked-post lookup fails", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_content_calendar_items: { data: [CALENDAR_ROW], error: null },
        architecta_posts: { data: null, error: { message: "db down" } },
      })
    );

    const res = await GET(new Request("http://localhost/api/calendar"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("includes the linked post's publishing state when the lookup succeeds", async () => {
    h.createSupabaseServerClient.mockResolvedValue(
      makeSupabase({
        architecta_content_calendar_items: { data: [CALENDAR_ROW], error: null },
        architecta_posts: {
          data: [{ id: "post-1", status: "failed", publish_error: "oops", publish_error_code: "platform_error" }],
          error: null,
        },
      })
    );

    const res = await GET(new Request("http://localhost/api/calendar"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: Array<{ postStatus: string | null }> } };
    expect(body.data.items[0].postStatus).toBe("failed");
  });
});
