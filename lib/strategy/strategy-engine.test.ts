import { afterEach, describe, expect, it, vi } from "vitest";

import { generateStrategyEnginePlan, type StrategyEngineInput } from "./strategy-engine";
import { normalizeStrategyRecord } from "./strategy-record";

const input: StrategyEngineInput = {
  businessNiche: "Northwind Studio — Brand design",
  audience: "Seed-stage founders",
  offer: "Two-week brand sprints",
  primaryGoal: "Book discovery calls",
  currentChallenge: "Low visibility",
  preferredPlatforms: ["LinkedIn", "Newsletter"],
};

/** What POST /api/strategies returns: the saved row as a canonical record. */
function savedStrategy(overrides: Record<string, unknown> = {}) {
  return normalizeStrategyRecord({
    id: "strat-1",
    kind: "strategy_engine",
    status: "active",
    summary: "Own the seed-stage brand sprint category.",
    pillars: [{ id: "p1", title: "Proof of speed", description: "Show the sprint.", items: ["Sprint teardown"] }],
    next_actions: ["Publish a teardown"],
    meta: { growthPriorities: ["Clarify the offer"], thirtyDayFocus: ["Week 1: case study"] },
    created_at: "2026-09-25T00:00:00.000Z",
    ...overrides,
  });
}

function mockResponse(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

// Phrases unique to the removed template fallback.
const TEMPLATE_PHRASES = ["Market Problem Clarity", "Proof And Authority", "Conversion Path", "Architecta should position"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateStrategyEnginePlan", () => {
  it("renders exactly the saved strategy", async () => {
    mockResponse({ ok: true, data: { strategy: savedStrategy(), generated: {} } });

    expect(await generateStrategyEnginePlan(input)).toEqual({
      strategicSummary: "Own the seed-stage brand sprint category.",
      contentPillars: [{ id: "p1", title: "Proof of speed", description: "Show the sprint.", moves: ["Sprint teardown"] }],
      growthPriorities: ["Clarify the offer"],
      recommendedNextMoves: ["Publish a teardown"],
      thirtyDayFocus: ["Week 1: case study"],
    });
  });

  it("leaves missing optional lists empty instead of filling them with template content", async () => {
    mockResponse({ ok: true, data: { strategy: savedStrategy({ next_actions: [], meta: {} }) } });

    const plan = await generateStrategyEnginePlan(input);
    expect(plan.growthPriorities).toEqual([]);
    expect(plan.recommendedNextMoves).toEqual([]);
    expect(plan.thirtyDayFocus).toEqual([]);
    for (const phrase of TEMPLATE_PHRASES) expect(JSON.stringify(plan)).not.toContain(phrase);
  });

  it.each([
    ["missing summary", { summary: null }],
    ["missing pillars", { pillars: [] }],
  ])("errors on %s rather than showing canned strategy", async (_label, overrides) => {
    mockResponse({ ok: true, data: { strategy: savedStrategy(overrides) } });
    await expect(generateStrategyEnginePlan(input)).rejects.toThrow(/incomplete/);
  });

  it("surfaces the server's rejection of incomplete AI output", async () => {
    mockResponse(
      { ok: false, error: { code: "upstream_error", message: "The AI returned an incomplete strategy, so nothing was saved. Try generating again." } },
      502
    );
    await expect(generateStrategyEnginePlan(input)).rejects.toThrow(/incomplete strategy/);
  });

  it("does not render the raw generated payload when no saved strategy is returned", async () => {
    mockResponse({ ok: true, data: { generated: { summary: "Unsaved", contentPillars: [{ title: "X", items: ["y"] }] } } });
    await expect(generateStrategyEnginePlan(input)).rejects.toThrow();
  });
});
