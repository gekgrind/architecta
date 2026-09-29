import { describe, expect, it } from "vitest";

import { parseStrategyResponse } from "@/lib/ai/llm/prompts/strategy";

import {
  derivePillarId,
  generatedStrategyIssues,
  isBusinessStrategyKind,
  normalizeStrategyRecord,
  PARSER_PLACEHOLDER_PILLAR_TITLE,
  selectCurrentStrategy,
  type StrategyRecord,
} from "./strategy-record";

const row = {
  id: "strat-1",
  kind: "strategy_engine",
  title: "Northwind strategy",
  summary: "Own the seed-stage B2B brand sprint category.",
  status: "active",
  pillars: [
    { id: "p-persisted", title: "Proof of speed", description: "Show the sprint.", items: ["Teardown"] },
  ],
  audience_angles: ["Founders"],
  content_themes: [],
  posting_cadence: [],
  quick_wins: ["Pin a case study"],
  next_actions: ["Publish a teardown"],
  campaigns_seed: [{ title: "Idea", items: [] }],
  platform_strategy: { preferredPlatforms: ["LinkedIn"] },
  source_input: { businessNiche: "Brand design" },
  ai_provider: "anthropic",
  ai_model: "claude-sonnet",
  meta: { growthPriorities: ["Clarify the offer"], thirtyDayFocus: ["Week 1: case study"] },
  created_at: "2026-09-25T10:00:00.000Z",
  updated_at: "2026-09-26T10:00:00.000Z",
};

describe("normalizeStrategyRecord", () => {
  it("maps a current row to the canonical camelCase record", () => {
    expect(normalizeStrategyRecord(row)).toEqual({
      id: "strat-1",
      kind: "strategy_engine",
      title: "Northwind strategy",
      status: "active",
      summary: "Own the seed-stage B2B brand sprint category.",
      pillars: [{ id: "p-persisted", title: "Proof of speed", description: "Show the sprint.", items: ["Teardown"] }],
      audienceAngles: ["Founders"],
      contentThemes: [],
      postingCadence: [],
      quickWins: ["Pin a case study"],
      nextActions: ["Publish a teardown"],
      growthPriorities: ["Clarify the offer"],
      thirtyDayFocus: ["Week 1: case study"],
      campaignsSeed: [{ title: "Idea", items: [] }],
      platformStrategy: { preferredPlatforms: ["LinkedIn"] },
      sourceInput: { businessNiche: "Brand design" },
      aiProvider: "anthropic",
      aiModel: "claude-sonnet",
      meta: { growthPriorities: ["Clarify the offer"], thirtyDayFocus: ["Week 1: case study"] },
      createdAt: "2026-09-25T10:00:00.000Z",
      updatedAt: "2026-09-26T10:00:00.000Z",
    });
  });

  it("reads historical `items` and `moves` pillars without persisted ids", () => {
    const record = normalizeStrategyRecord({
      ...row,
      pillars: [
        { title: "Items pillar", description: "D", items: ["a", "b"] },
        { title: "Moves pillar", moves: ["c"] },
      ],
    });
    expect(record.pillars).toEqual([
      { id: derivePillarId("strat-1", 0, "Items pillar"), title: "Items pillar", description: "D", items: ["a", "b"] },
      { id: derivePillarId("strat-1", 1, "Moves pillar"), title: "Moves pillar", description: "", items: ["c"] },
    ]);
    expect(record.pillars[0].id).toBe("strat-1:p0:items-pillar");
  });

  it("derives the same pillar ids on every read", () => {
    const legacy = { ...row, pillars: [{ title: "A" }, { title: "B" }] };
    const first = normalizeStrategyRecord(legacy).pillars.map((p) => p.id);
    const second = normalizeStrategyRecord(structuredClone(legacy)).pillars.map((p) => p.id);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
  });

  it("keeps ids unique when two legacy pillars share a title", () => {
    const record = normalizeStrategyRecord({ ...row, pillars: [{ title: "Same" }, { title: "Same" }] });
    expect(record.pillars[0].id).not.toBe(record.pillars[1].id);
  });

  it("skips malformed pillars without shifting the ids of valid ones", () => {
    const record = normalizeStrategyRecord({
      ...row,
      pillars: [null, "text", { description: "no title" }, { title: "   " }, { title: "Kept", items: [1, "x", ""] }],
    });
    expect(record.pillars).toEqual([
      { id: derivePillarId("strat-1", 4, "Kept"), title: "Kept", description: "", items: ["x"] },
    ]);
  });

  it("tolerates missing optional fields and malformed columns", () => {
    const record = normalizeStrategyRecord({ id: "s", created_at: "2026-01-01T00:00:00.000Z", pillars: "nope", meta: [] });
    expect(record).toMatchObject({
      kind: "content_strategy",
      status: "draft",
      title: null,
      summary: null,
      pillars: [],
      nextActions: [],
      growthPriorities: [],
      platformStrategy: {},
      sourceInput: {},
      meta: {},
      aiProvider: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(normalizeStrategyRecord(null).id).toBe("");
  });

  it("never reads an unknown status as active", () => {
    expect(normalizeStrategyRecord({ ...row, status: "ACTIVE" }).status).toBe("draft");
  });
});

describe("business strategy eligibility", () => {
  it("only strategy_engine and custom qualify", () => {
    expect(isBusinessStrategyKind("strategy_engine")).toBe(true);
    expect(isBusinessStrategyKind("custom")).toBe(true);
    expect(isBusinessStrategyKind("content_strategy")).toBe(false);
    expect(isBusinessStrategyKind("content_architect")).toBe(false);
    expect(isBusinessStrategyKind(null)).toBe(false);
  });
});

describe("selectCurrentStrategy", () => {
  const rec = (overrides: Partial<StrategyRecord>): StrategyRecord => ({
    ...normalizeStrategyRecord(row),
    status: "draft",
    ...overrides,
  });

  it("prefers an active strategy over a newer draft", () => {
    const current = selectCurrentStrategy([
      rec({ id: "draft", createdAt: "2026-09-26T00:00:00.000Z" }),
      rec({ id: "active", status: "active", createdAt: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(current).toMatchObject({ record: { id: "active" }, isActive: true });
  });

  it("falls back to the newest draft without calling it active", () => {
    const current = selectCurrentStrategy([
      rec({ id: "older", createdAt: "2026-09-01T00:00:00.000Z" }),
      rec({ id: "newer", createdAt: "2026-09-20T00:00:00.000Z" }),
    ]);
    expect(current).toMatchObject({ record: { id: "newer", status: "draft" }, isActive: false });
  });

  it("ignores content plans and archived strategies", () => {
    expect(
      selectCurrentStrategy([
        rec({ id: "cs", kind: "content_strategy", status: "active" }),
        rec({ id: "ca", kind: "content_architect", status: "active" }),
        rec({ id: "arch", status: "archived" }),
      ])
    ).toBeNull();
  });

  it("resolves several legacy active rows to the newest, deterministically", () => {
    const rows = [
      rec({ id: "a", status: "active", createdAt: "2026-09-01T00:00:00.000Z" }),
      rec({ id: "c", status: "active", createdAt: "2026-09-10T00:00:00.000Z" }),
      rec({ id: "b", status: "active", createdAt: "2026-09-10T00:00:00.000Z" }),
    ];
    expect(selectCurrentStrategy(rows)?.record.id).toBe("c");
    expect(selectCurrentStrategy([...rows].reverse())?.record.id).toBe("c");
  });
});

describe("generatedStrategyIssues", () => {
  const pillar = { title: "Proof", description: "", items: ["Ship a teardown"] };

  it("accepts a summary plus one usable pillar", () => {
    expect(generatedStrategyIssues({ summary: "A clear strategic summary for founders.", contentPillars: [pillar] })).toEqual([]);
  });

  it("rejects an empty or trivial summary", () => {
    expect(generatedStrategyIssues({ summary: "", contentPillars: [pillar] })).toEqual(["missing_summary"]);
    expect(generatedStrategyIssues({ summary: "  ok  ", contentPillars: [pillar] })).toEqual(["missing_summary"]);
  });

  it("rejects pillars without a real title or any content", () => {
    const summary = "A clear strategic summary for founders.";
    for (const contentPillars of [
      [],
      [{ title: "", items: ["x"] }],
      [{ title: PARSER_PLACEHOLDER_PILLAR_TITLE, items: ["x"] }],
      [{ title: "Empty", description: " ", items: [] }],
    ]) {
      expect(generatedStrategyIssues({ summary, contentPillars })).toEqual(["no_usable_pillars"]);
    }
  });

  it("matches the placeholder title the response parser substitutes", () => {
    const parsed = parseStrategyResponse(JSON.stringify({ contentPillars: [{ items: ["x"] }] }));
    expect(parsed.contentPillars[0].title).toBe(PARSER_PLACEHOLDER_PILLAR_TITLE);
  });
});
