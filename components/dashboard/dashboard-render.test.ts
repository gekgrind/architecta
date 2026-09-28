import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/config/ecosystem", () => ({
  getCommandCenterUrl: () => "https://entrepreneuria.io/dashboard",
}));

import { ArchitectaDashboard } from "./ArchitectaDashboard";
import { buildDashboardModel, type DashboardResult, type DashboardSources } from "@/lib/dashboard/model";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const ok = <T,>(data: T) => ({ ok: true as const, data });

const identity = { displayName: "Misti", workspaceName: "Northwind" };

function render(dashboard: DashboardResult) {
  return renderToStaticMarkup(createElement(ArchitectaDashboard, { identity, dashboard }));
}

function sources(overrides: Partial<DashboardSources> = {}): DashboardSources {
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

// Strings from the former decorative dashboard that must never come back.
const FABRICATED = [
  "78%",
  "94/100",
  "128k",
  "8 Alerts",
  "vs previous orbit",
  "98.2%",
  "Risk Factor",
  "09:42:15 UTC",
  "surging demand",
  "Organic Reach Evolution",
  "Projected",
  "X-Corp",
  "Market Infiltration",
  "Live Opportunity Feed",
  "+8",
];

describe("ArchitectaDashboard", () => {
  it("renders a first-run account with honest empty states and no fabricated data", () => {
    const html = render({ status: "ready", model: buildDashboardModel(sources(), NOW) });

    for (const fake of FABRICATED) expect(html).not.toContain(fake);
    expect(html).toContain("No strategy yet");
    expect(html).toContain("Build your first growth strategy");
    expect(html).toContain("Create Strategy");
    expect(html).toContain("Nothing published yet · engagement not connected");
    expect(html).toContain("0 of 7");
    expect(html).toContain("hasn&#x27;t analyzed a website");
    expect(html).toContain(
      "Performance insights will appear after Architecta has campaign or publishing data to analyze."
    );
    // AI usage telemetry moved to Settings.
    expect(html).not.toContain("AI Usage");
  });

  it("personalizes the dashboard with onboarding intelligence", () => {
    const html = render({
      status: "ready",
      model: buildDashboardModel(
        sources({
          brandProfile: ok({
            brand_name: "Northwind Studio",
            industry: "Brand design",
            website: "https://northwind.studio",
            description: "Brand identity sprints for seed-stage founders.",
            audience: "Seed-stage founders",
            typical_customers: null,
            offers: null,
            tone: null,
            tone_voice: "Confident",
            voice_description: null,
            mission: null,
            source: {
              websiteInsights: {
                differentiators: ["Two-week turnaround"],
                confidence: "high",
                analyzed_at: "2026-09-20T00:00:00.000Z",
              },
            },
          }),
        }),
        NOW
      ),
    });

    expect(html).toContain("Northwind Studio · Brand design");
    expect(html).toContain("Brand identity sprints for seed-stage founders.");
    expect(html).toContain("Two-week turnaround");
    expect(html).toContain("Analyzed Sep 20, 2026");
    expect(html).toContain("does not monitor your");
  });

  it("makes opening the existing strategy the primary action and keeps performance honest", () => {
    const html = render({
      status: "ready",
      model: buildDashboardModel(
        sources({
          strategies: ok([
            {
              id: "s1",
              kind: "strategy_engine",
              title: "Own the two-week sprint",
              summary: null,
              status: "active",
              pillars: [],
              next_actions: [],
              quick_wins: [],
              meta: null,
              created_at: "2026-09-25T00:00:00.000Z",
            },
          ]),
          posts: ok([
            { status: "draft", title: "A", platform: "x", scheduled_for: null },
            { status: "published", title: "B", platform: "x", scheduled_for: null },
          ]),
        }),
        NOW
      ),
    });

    expect(html).toContain("Open Strategy");
    expect(html).not.toContain("Create Strategy");
    expect(html).not.toContain("New Strategy");
    expect(html).toContain("in pipeline");
    expect(html).toContain("Awaiting data");
    expect(html).toContain("1 published · engagement not connected");
    expect(html).not.toContain(">Results<");
  });

  it("shows an error state instead of placeholder content when loading fails", () => {
    const html = render({ status: "error", message: "Architecta couldn't load your workspace right now." });
    expect(html).toContain("Workspace unavailable");
    expect(html).not.toContain("AI Strategy Blueprint");
  });

  it("uses the grouped navigation with real routes and no dead AI input", () => {
    const html = render({ status: "ready", model: buildDashboardModel(sources(), NOW) });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/strategy-engine"');
    expect(html).not.toContain("#competitor-intel");
    expect(html).not.toContain("Ask AI to architect");
    expect(html).toContain("Jump to strategy, content, calendar");
  });
});
