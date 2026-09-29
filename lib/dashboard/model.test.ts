import { describe, expect, it } from "vitest";

import {
  buildDashboardModel,
  formatDateLabel,
  MAX_DASHBOARD_ACTIONS,
  type BrandProfileSource,
  type DashboardSources,
  type StrategySource,
} from "./model";

const NOW = new Date("2026-09-27T12:00:00.000Z");

const ok = <T,>(data: T) => ({ ok: true as const, data });
const failed = { ok: false as const };

function emptySources(overrides: Partial<DashboardSources> = {}): DashboardSources {
  return {
    brandProfile: ok(null),
    onboarding: ok(null),
    websiteAnalysis: ok(null),
    strategies: ok([]),
    posts: ok([]),
    campaigns: ok([]),
    publishLog: ok([]),
    connections: ok([]),
    ...overrides,
  };
}

const brand: BrandProfileSource = {
  brand_name: "Northwind Studio",
  industry: "Brand design",
  website: "https://www.northwind.studio",
  description: "Brand identity sprints for seed-stage B2B founders.",
  audience: "Seed-stage B2B SaaS founders",
  typical_customers: null,
  offers: null,
  tone: "Confident",
  tone_voice: "Confident, bold",
  voice_description: null,
  mission: null,
  source: {
    onboarding: true,
    websiteInsights: {
      differentiators: ["Two-week turnaround", "Founder-led workshops"],
      topics: ["Positioning", "Brand systems"],
      cta_patterns: ["Book a discovery call"],
      confidence: "high",
      analyzed_at: "2026-09-20T09:00:00.000Z",
    },
  },
};

const strategy: StrategySource = {
  id: "s1",
  kind: "strategy_engine",
  title: "Northwind Studio — Brand design strategy",
  summary: "Own the seed-stage B2B brand sprint category.",
  status: "draft",
  pillars: [
    { title: "Proof of speed", description: "Show the two-week sprint.", items: [] },
    { title: "Founder education", items: ["Why positioning precedes design"] },
  ],
  next_actions: ["Publish a sprint teardown"],
  quick_wins: ["Pin a case study"],
  meta: { thirtyDayFocus: ["Week 1: case study"], growthPriorities: ["Clarify the offer"] },
  created_at: "2026-09-25T10:00:00.000Z",
};

describe("buildDashboardModel — first run", () => {
  it("shows an honest empty state for a brand-new account", () => {
    const model = buildDashboardModel(emptySources(), NOW);

    expect(model.knowledge.status).toBe("ready");
    expect(model.knowledge.knownCount).toBe(0);
    expect(model.strategy.latest).toBeNull();
    expect(model.websiteAnalysis.status).toBe("none");
    expect(model.execution.total).toBe(0);
    expect(model.loop.map((stage) => stage.state)).toEqual(["empty", "empty", "empty", "empty"]);
    expect(model.actions.map((action) => action.id)).toEqual([
      "first-strategy",
      "complete-profile",
      "connect-channel",
    ]);
  });

  it("uses onboarding intelligence immediately after onboarding", () => {
    const model = buildDashboardModel(
      emptySources({
        brandProfile: ok(brand),
        onboarding: ok({
          id: "sess",
          status: "completed",
          answers: {
            competitors: ["Acme Brand Co", "Pixel Forge"],
            primary_market: "North America",
            customer_pains: ["Inconsistent brand", "Slow agencies"],
          },
        }),
      }),
      NOW
    );

    expect(model.business).toEqual({
      name: "Northwind Studio",
      industry: "Brand design",
      website: "https://www.northwind.studio",
      description: "Brand identity sprints for seed-stage B2B founders.",
    });

    const field = (id: string) => model.knowledge.fields.find((f) => f.id === id)!;
    expect(field("audience")).toMatchObject({ value: "Seed-stage B2B SaaS founders", source: "brand_profile" });
    expect(field("voice").value).toBe("Confident, bold");
    expect(field("competitors")).toMatchObject({ values: ["Acme Brand Co", "Pixel Forge"], source: "onboarding" });
    expect(field("differentiators")).toMatchObject({
      values: ["Two-week turnaround", "Founder-led workshops"],
      source: "website_analysis",
    });
    expect(field("offers")).toMatchObject({ value: null, editHref: null });
    expect(model.knowledge.knownCount).toBe(6);
    expect(model.knowledge.context).toEqual(
      expect.arrayContaining([
        { id: "market", label: "Market", value: "North America" },
        { id: "pains", label: "Customer pains", value: "Inconsistent brand, Slow agencies" },
      ])
    );

    // Website insights saved on the brand profile power the signals panel.
    expect(model.websiteAnalysis).toMatchObject({
      status: "completed",
      domain: "northwind.studio",
      analyzedLabel: "Sep 20, 2026",
      confidence: "high",
      ctaPatterns: ["Book a discovery call"],
    });

    const first = model.actions[0];
    expect(first.id).toBe("first-strategy");
    expect(first.reason).toContain("6 of 7");
  });

  it("falls back to a completed website-analysis job, labelled as such", () => {
    const model = buildDashboardModel(
      emptySources({
        onboarding: ok({ id: "sess", status: "in_progress", answers: {} }),
        websiteAnalysis: ok({
          status: "completed",
          url: "https://acme.io",
          completed_at: "2026-09-26T08:00:00.000Z",
          result: {
            brand_name: "Acme",
            offers: "Fractional CMO retainers",
            differentiators: ["Ex-operator team"],
            confidence: "medium",
            analyzed_at: "2026-09-26T08:00:00.000Z",
          },
        }),
      }),
      NOW
    );

    const offers = model.knowledge.fields.find((f) => f.id === "offers")!;
    expect(offers).toMatchObject({ value: "Fractional CMO retainers", source: "website_analysis" });
    expect(model.business.name).toBe("Acme");
    expect(model.websiteAnalysis.domain).toBe("acme.io");
  });

  it("never presents a low-confidence analysis as known facts", () => {
    const model = buildDashboardModel(
      emptySources({
        onboarding: ok({ id: "sess", status: "completed", answers: {} }),
        websiteAnalysis: ok({
          status: "completed",
          url: "https://vague.example",
          completed_at: null,
          result: { brand_name: "Maybe Co", offers: "Unclear", confidence: "low", topics: ["Misc"] },
        }),
      }),
      NOW
    );

    expect(model.knowledge.knownCount).toBe(0);
    expect(model.business.name).toBeNull();
    // Still shown as a clearly-labelled low-confidence snapshot.
    expect(model.websiteAnalysis).toMatchObject({ status: "completed", confidence: "low", topics: ["Misc"] });
  });

  it("uses insights saved on the brand profile when the jobs table can't be read", () => {
    const model = buildDashboardModel(emptySources({ brandProfile: ok(brand), websiteAnalysis: failed }), NOW);
    expect(model.websiteAnalysis).toMatchObject({ status: "completed", domain: "northwind.studio" });
    expect(buildDashboardModel(emptySources({ websiteAnalysis: failed }), NOW).websiteAnalysis.status).toBe("error");
  });

  it.each([
    ["queued", "pending"],
    ["processing", "pending"],
    ["failed", "failed"],
  ])("reports a %s analysis job as %s", (jobStatus, expected) => {
    const model = buildDashboardModel(
      emptySources({
        onboarding: ok({ id: "sess", status: "completed", answers: {} }),
        websiteAnalysis: ok({ status: jobStatus, url: "https://acme.io", completed_at: null, result: null }),
      }),
      NOW
    );
    expect(model.websiteAnalysis.status).toBe(expected);
    expect(model.websiteAnalysis.differentiators).toEqual([]);
  });
});

describe("buildDashboardModel — strategy, execution and results", () => {
  it("summarizes the latest saved strategy from persisted fields only", () => {
    const model = buildDashboardModel(
      emptySources({
        brandProfile: ok(brand),
        strategies: ok([
          { ...strategy, id: "old", created_at: "2026-09-01T00:00:00.000Z", title: "Old" },
          strategy,
          { ...strategy, id: "gone", status: "archived", created_at: "2026-09-26T00:00:00.000Z" },
        ]),
      }),
      NOW
    );

    expect(model.strategy.savedCount).toBe(2);
    expect(model.strategy.latest).toMatchObject({
      id: "s1",
      kindLabel: "Growth strategy",
      createdLabel: "Sep 25, 2026",
      pillars: [
        { title: "Proof of speed", description: "Show the two-week sprint." },
        { title: "Founder education", description: "Why positioning precedes design" },
      ],
      focus: ["Week 1: case study"],
      nextMoves: ["Publish a sprint teardown", "Pin a case study"],
    });
    expect(model.actions.find((a) => a.id === "first-content")?.title).toBe("Create content for “Proof of speed”");
    expect(model.actions.some((a) => a.id === "first-strategy")).toBe(false);
  });

  it("prefers an explicitly active strategy over a newer draft", () => {
    const model = buildDashboardModel(
      emptySources({
        strategies: ok([strategy, { ...strategy, id: "active", status: "active", created_at: "2026-08-01T00:00:00.000Z" }]),
      }),
      NOW
    );
    expect(model.strategy.latest?.id).toBe("active");
    expect(model.strategy.latest).toMatchObject({ isActive: true, statusLabel: "Active" });
    expect(model.loop[1].value).toBe("Active");
  });

  it("shows the newest draft as a latest draft, never as active", () => {
    const model = buildDashboardModel(
      emptySources({
        strategies: ok([
          { ...strategy, id: "older", created_at: "2026-09-01T00:00:00.000Z" },
          strategy,
        ]),
      }),
      NOW
    );
    expect(model.strategy.latest).toMatchObject({ id: "s1", status: "draft", isActive: false, statusLabel: "Latest draft" });
    expect(model.loop[1].value).toBe("Drafted");
  });

  it("never lets a Content Strategy or Content Architect plan become the current strategy", () => {
    const model = buildDashboardModel(
      emptySources({
        strategies: ok([
          { ...strategy, id: "cs", kind: "content_strategy", status: "active", created_at: "2026-09-26T00:00:00.000Z" },
          { ...strategy, id: "ca", kind: "content_architect", status: "active", created_at: "2026-09-27T00:00:00.000Z" },
          { ...strategy, id: "engine", created_at: "2026-09-01T00:00:00.000Z" },
        ]),
      }),
      NOW
    );
    expect(model.strategy.latest).toMatchObject({ id: "engine", isActive: false });
    expect(model.strategy.savedCount).toBe(1);
  });

  it("reports no strategy when only content plans or archived strategies exist", () => {
    const model = buildDashboardModel(
      emptySources({
        strategies: ok([
          { ...strategy, id: "cs", kind: "content_strategy", status: "active" },
          { ...strategy, id: "ca", kind: "content_architect" },
          { ...strategy, id: "gone", status: "archived" },
        ]),
      }),
      NOW
    );
    expect(model.strategy.latest).toBeNull();
    expect(model.actions.some((a) => a.id === "first-strategy")).toBe(true);
  });

  it("resolves several legacy active strategies to the newest", () => {
    const rows: StrategySource[] = [
      { ...strategy, id: "a1", status: "active", created_at: "2026-09-01T00:00:00.000Z" },
      { ...strategy, id: "a2", status: "active", created_at: "2026-09-20T00:00:00.000Z" },
      { ...strategy, id: "d", status: "draft", created_at: "2026-09-26T00:00:00.000Z" },
    ];
    expect(buildDashboardModel(emptySources({ strategies: ok(rows) }), NOW).strategy.latest?.id).toBe("a2");
    expect(buildDashboardModel(emptySources({ strategies: ok([...rows].reverse()) }), NOW).strategy.latest?.id).toBe("a2");
  });

  it("gives pillars stable ids across reads", () => {
    const read = () => buildDashboardModel(emptySources({ strategies: ok([strategy]) }), NOW).strategy.latest?.pillars;
    expect(read()?.map((p) => p.id)).toEqual(["s1:p0:proof-of-speed", "s1:p1:founder-education"]);
    expect(read()).toEqual(read());
  });

  it("counts the content pipeline and the next scheduled post", () => {
    const model = buildDashboardModel(
      emptySources({
        posts: ok([
          { status: "draft", title: "A", platform: "linkedin", scheduled_for: null },
          { status: "approved", title: "B", platform: "x", scheduled_for: null },
          { status: "scheduled", title: "Later", platform: "x", scheduled_for: "2026-10-20T10:00:00.000Z" },
          { status: "scheduled", title: "Soon", platform: "linkedin", scheduled_for: "2026-09-29T10:00:00.000Z" },
          { status: "published", title: "C", platform: "x", scheduled_for: null },
          { status: "archived", title: "D", platform: "x", scheduled_for: null },
        ]),
      }),
      NOW
    );

    expect(model.execution).toMatchObject({
      total: 5,
      drafts: 1,
      approved: 1,
      scheduled: 2,
      published: 1,
      upcomingWeek: 1,
      nextScheduled: { title: "Soon", platform: "linkedin", label: "Sep 29, 2026" },
    });
    expect(model.loop[2]).toMatchObject({
      id: "execution",
      value: "4",
      unit: "in pipeline",
      caption: "1 draft · 1 approved · 2 scheduled",
    });
    // Publishing volume is never presented as a performance result.
    expect(model.loop[3]).toMatchObject({
      id: "performance",
      label: "Performance",
      value: "Awaiting data",
      caption: "1 published · engagement not connected",
      state: "awaiting",
    });
    expect(model.actions.find((a) => a.id === "review-drafts")).toBeDefined();
  });

  it("asks to schedule ready drafts when nothing publishes this week", () => {
    const model = buildDashboardModel(
      emptySources({
        posts: ok([{ status: "approved", title: "B", platform: "x", scheduled_for: null }]),
      }),
      NOW
    );
    expect(model.actions.find((a) => a.id === "schedule-drafts")?.title).toBe("Schedule 1 ready draft");
  });

  it("puts recent publish failures first with the reason", () => {
    const model = buildDashboardModel(
      emptySources({
        strategies: ok([strategy]),
        connections: ok([{ kind: "platform", name: "linkedin", status: "connected" }]),
        publishLog: ok([
          { status: "success", platform: "linkedin", created_at: "2026-09-20T00:00:00.000Z" },
          { status: "error", platform: "linkedin", created_at: "2026-09-26T00:00:00.000Z" },
          { status: "error", platform: "x", created_at: "2026-07-01T00:00:00.000Z" },
        ]),
      }),
      NOW
    );

    expect(model.publishing).toMatchObject({
      successes30d: 1,
      failures30d: 1,
      lastFailure: { platform: "linkedin", label: "Sep 26, 2026" },
    });
    expect(model.actions[0]).toMatchObject({ id: "publish-failures", priority: "high" });
    expect(model.actions[0].reason).toContain("on linkedin on Sep 26, 2026");
  });

  it("flags broken connections instead of asking to connect", () => {
    const model = buildDashboardModel(
      emptySources({
        connections: ok([
          { kind: "platform", name: "linkedin", status: "connected" },
          { kind: "destination", name: "wordpress", status: "expired" },
        ]),
      }),
      NOW
    );
    expect(model.actions.some((a) => a.id === "connect-channel")).toBe(false);
    expect(model.actions.find((a) => a.id === "reconnect-channel")?.priority).toBe("high");
  });

  it("caps the queue and keeps high-priority actions first", () => {
    const model = buildDashboardModel(
      emptySources({
        posts: ok([{ status: "draft", title: "A", platform: "x", scheduled_for: null }]),
        publishLog: ok([{ status: "error", platform: "x", created_at: "2026-09-26T00:00:00.000Z" }]),
        connections: ok([{ kind: "platform", name: "x", status: "revoked" }]),
      }),
      NOW
    );
    expect(model.actions.length).toBeLessThanOrEqual(MAX_DASHBOARD_ACTIONS);
    const firstNormal = model.actions.findIndex((a) => a.priority === "normal");
    const lastHigh = model.actions.map((a) => a.priority).lastIndexOf("high");
    expect(firstNormal === -1 || lastHigh < firstNormal).toBe(true);
  });
});

describe("buildDashboardModel — failed sources", () => {
  it("marks failed sections unavailable instead of substituting empty data", () => {
    const model = buildDashboardModel(
      {
        brandProfile: failed,
        onboarding: failed,
        websiteAnalysis: failed,
        strategies: failed,
        posts: failed,
        campaigns: failed,
        publishLog: failed,
        connections: failed,
      },
      NOW
    );

    expect(model.knowledge.status).toBe("error");
    expect(model.strategy.status).toBe("error");
    expect(model.execution.status).toBe("error");
    expect(model.publishing.status).toBe("error");
    expect(model.websiteAnalysis.status).toBe("error");
    expect(model.loop.every((stage) => stage.state === "unavailable" && stage.value === "—")).toBe(true);
    // No action may be derived from data that failed to load.
    expect(model.actions).toEqual([]);
  });

  it("does not claim 'no strategy' when strategies failed to load", () => {
    const model = buildDashboardModel(emptySources({ strategies: failed }), NOW);
    expect(model.actions.some((a) => a.id === "first-strategy")).toBe(false);
  });
});

describe("formatDateLabel", () => {
  it("is deterministic in UTC and tolerates bad input", () => {
    expect(formatDateLabel("2026-01-01T00:30:00.000Z")).toBe("Jan 1, 2026");
    expect(formatDateLabel("not a date")).toBeNull();
    expect(formatDateLabel(null)).toBeNull();
  });
});
