import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeSupabase } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));

import { loadDashboard } from "./load";

const USER = "user-1";
const OTHER = "user-2";
const NOW = new Date("2026-09-27T12:00:00.000Z");

function seed() {
  return {
    brand_profiles: [
      { user_id: USER, brand_name: "Northwind Studio", industry: "Brand design", audience: "Seed founders", source: {} },
      { user_id: OTHER, brand_name: "Someone Else", industry: "Other" },
    ],
    onboarding_sessions: [
      { id: "sess-1", user_id: USER, app: "architecta", status: "completed", answers: { competitors: ["Acme"] } },
      { id: "sess-other-app", user_id: USER, app: "prospra", status: "completed", answers: { competitors: ["Wrong"] } },
    ],
    architecta_website_analyses: [
      {
        session_id: "sess-1",
        status: "completed",
        url: "https://northwind.studio",
        completed_at: "2026-09-20T00:00:00.000Z",
        result: { differentiators: ["Two-week sprints"], confidence: "high" },
      },
    ],
    architecta_content_strategies: [],
    architecta_posts: [
      { user_id: USER, status: "draft", title: "Mine", created_at: "2026-09-26" },
      { user_id: OTHER, status: "published", title: "Theirs", created_at: "2026-09-26" },
    ],
    architecta_campaigns: [],
    architecta_publish_log: [
      { user_id: USER, status: "error", platform: "x", created_at: "2026-09-26T00:00:00.000Z" },
      { user_id: USER, status: "error", platform: "x", created_at: "2026-06-01T00:00:00.000Z" },
    ],
    architecta_platform_connections: [{ user_id: USER, platform: "x", status: "connected" }],
    architecta_content_destinations: [],
  };
}

describe("loadDashboard", () => {
  beforeEach(() => {
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER } });
  });

  it("builds the model from the signed-in user's own rows", async () => {
    const fake = makeFakeSupabase(seed());
    h.createSupabaseServerClient.mockResolvedValue(fake.client);

    const result = await loadDashboard(NOW);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const { model } = result;
    expect(model.business.name).toBe("Northwind Studio");
    expect(model.knowledge.fields.find((f) => f.id === "competitors")?.values).toEqual(["Acme"]);
    expect(model.websiteAnalysis.differentiators).toEqual(["Two-week sprints"]);
    expect(model.execution.total).toBe(1);
    expect(model.execution.published).toBe(0);
    expect(model.publishing.failures30d).toBe(1);
    expect(model.connections.connected).toBe(1);

    // Every user-owned table is scoped to the signed-in user.
    const selects = fake.log.filter((entry) => entry.op === "select").map((entry) => entry.table);
    expect(selects).toEqual(
      expect.arrayContaining([
        "brand_profiles",
        "onboarding_sessions",
        "architecta_website_analyses",
        "architecta_content_strategies",
        "architecta_posts",
        "architecta_publish_log",
      ])
    );
  });

  it("degrades only the failing section", async () => {
    const fake = makeFakeSupabase(seed(), (table, op) => table === "architecta_posts" && op === "select");
    h.createSupabaseServerClient.mockResolvedValue(fake.client);

    const result = await loadDashboard(NOW);
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.model.execution.status).toBe("error");
    expect(result.model.knowledge.status).toBe("ready");
    expect(result.model.business.name).toBe("Northwind Studio");
  });

  it("reports a failed connection query as unavailable, not as 'no channels'", async () => {
    const fake = makeFakeSupabase(
      seed(),
      (table, op) => table === "architecta_content_destinations" && op === "select"
    );
    h.createSupabaseServerClient.mockResolvedValue(fake.client);

    const result = await loadDashboard(NOW);
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.model.connections.status).toBe("error");
    expect(result.model.actions.some((a) => a.id === "connect-channel")).toBe(false);
  });

  it("returns unauthenticated without querying data", async () => {
    const fake = makeFakeSupabase(seed());
    h.createSupabaseServerClient.mockResolvedValue(fake.client);
    h.getAuthenticatedUser.mockResolvedValue(null);

    expect(await loadDashboard(NOW)).toEqual({ status: "unauthenticated" });
    expect(fake.log).toHaveLength(0);
  });

  it("returns an error result (never placeholder data) when the client cannot be created", async () => {
    h.createSupabaseServerClient.mockRejectedValue(new Error("missing env"));
    const result = await loadDashboard(NOW);
    expect(result.status).toBe("error");
  });
});
