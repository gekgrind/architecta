import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeSupabase } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));

import { GET, PATCH } from "./route";

const USER = "user-1";
const OTHER = "user-2";
const STRATEGIES = "architecta_content_strategies";

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: USER,
    kind: "strategy_engine",
    status: "draft",
    title: `Strategy ${id}`,
    summary: "Own the seed-stage B2B brand sprint category.",
    pillars: [],
    next_actions: [],
    meta: {},
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(rows: Record<string, unknown>[], failWhen?: Parameters<typeof makeFakeSupabase>[1]) {
  const fake = makeFakeSupabase({ [STRATEGIES]: rows }, failWhen);
  h.createSupabaseServerClient.mockResolvedValue(fake.client);
  return fake;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/strategies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id)
  );
}

const statusOf = (fake: ReturnType<typeof setup>, id: string) =>
  fake.tables[STRATEGIES].find((r) => r.id === id)?.status;

beforeEach(() => {
  h.getAuthenticatedUser.mockReset();
  h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER } });
});

describe("GET /api/strategies/[id]", () => {
  it("returns the canonical camelCase record with normalized pillars", async () => {
    setup([
      row("s1", {
        status: "active",
        pillars: [{ title: "Historical", moves: ["Ship it"] }, { title: "" }],
        next_actions: ["Publish"],
        meta: { growthPriorities: ["Clarify"], thirtyDayFocus: ["Week 1"] },
        ai_provider: "anthropic",
      }),
    ]);

    const res = await GET(new Request("http://localhost/api/strategies/s1"), ctx("s1"));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { strategy: Record<string, unknown> } };
    expect(data.strategy).toMatchObject({
      id: "s1",
      kind: "strategy_engine",
      status: "active",
      nextActions: ["Publish"],
      growthPriorities: ["Clarify"],
      thirtyDayFocus: ["Week 1"],
      aiProvider: "anthropic",
      createdAt: "2026-09-01T00:00:00.000Z",
      pillars: [{ id: "s1:p0:historical", title: "Historical", description: "", items: ["Ship it"] }],
    });
    expect(data.strategy).not.toHaveProperty("next_actions");
    expect(data.strategy).not.toHaveProperty("created_at");
  });

  it("returns 404 for another user's strategy", async () => {
    setup([row("theirs", { user_id: OTHER })]);
    const res = await GET(new Request("http://localhost/api/strategies/theirs"), ctx("theirs"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    setup([row("s1")]);
    h.getAuthenticatedUser.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/strategies/s1"), ctx("s1"))).status).toBe(401);
  });
});

describe("PATCH /api/strategies/[id] — activation", () => {
  it("demotes the previous active strategy and activates the selected one", async () => {
    const fake = setup([
      row("old-active", { status: "active" }),
      row("target"),
      row("cs-active", { kind: "content_strategy", status: "active" }),
      row("theirs", { user_id: OTHER, status: "active" }),
    ]);

    const res = await patch("target", { status: "active" });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { strategy: Record<string, unknown> } };
    expect(data.strategy).toMatchObject({ id: "target", status: "active", createdAt: "2026-09-01T00:00:00.000Z" });

    expect(statusOf(fake, "target")).toBe("active");
    expect(statusOf(fake, "old-active")).toBe("draft");
    // Content plans and other users' rows are untouched.
    expect(statusOf(fake, "cs-active")).toBe("active");
    expect(statusOf(fake, "theirs")).toBe("active");
  });

  it("repairs several legacy active strategies down to the selected one", async () => {
    const fake = setup([row("a", { status: "active" }), row("b", { status: "active" }), row("c")]);
    expect((await patch("b", { status: "active" })).status).toBe(200);
    expect(fake.tables[STRATEGIES].filter((r) => r.status === "active").map((r) => r.id)).toEqual(["b"]);
  });

  it("cannot activate another user's strategy", async () => {
    const fake = setup([row("mine", { status: "active" }), row("theirs", { user_id: OTHER })]);
    const res = await patch("theirs", { status: "active" });
    expect(res.status).toBe(404);
    expect(statusOf(fake, "theirs")).toBe("draft");
    expect(statusOf(fake, "mine")).toBe("active");
  });

  it.each(["content_strategy", "content_architect"])("cannot activate a %s plan", async (kind) => {
    const fake = setup([row("current", { status: "active" }), row("plan", { kind })]);
    const res = await patch("plan", { status: "active" });
    expect(res.status).toBe(422);
    expect(statusOf(fake, "plan")).toBe("draft");
    expect(statusOf(fake, "current")).toBe("active");
  });

  it("restores the previous active strategy when activation fails", async () => {
    // Fail the activation update (the first status:"active" write), not the restore.
    let activationWrites = 0;
    const fake = setup(
      [row("old-active", { status: "active" }), row("target")],
      (_table, op, values) => op === "update" && values.status === "active" && activationWrites++ === 0
    );

    const res = await patch("target", { status: "active" });
    expect(res.status).toBe(500);
    expect(statusOf(fake, "target")).toBe("draft");
    expect(statusOf(fake, "old-active")).toBe("active");
  });

  it("keeps existing semantics for non-activation status changes", async () => {
    const fake = setup([row("a", { status: "active" }), row("b", { status: "active" })]);
    expect((await patch("a", { status: "archived" })).status).toBe(200);
    expect(statusOf(fake, "a")).toBe("archived");
    expect(statusOf(fake, "b")).toBe("active");
  });

  it("returns canonical records for non-status edits", async () => {
    setup([row("a", { pillars: [{ title: "P", items: ["x"] }] })]);
    const res = await patch("a", { title: "Renamed" });
    const { data } = (await res.json()) as { data: { strategy: Record<string, unknown> } };
    expect(data.strategy).toMatchObject({ title: "Renamed", pillars: [{ id: "a:p0:p", title: "P" }] });
  });
});
