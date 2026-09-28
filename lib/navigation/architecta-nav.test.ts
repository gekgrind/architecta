import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARCHITECTA_NAV_ITEMS,
  ARCHITECTA_SECONDARY_DESTINATIONS,
  isNavItemActive,
} from "./architecta-nav";
import { buildSidebarNavigation } from "./sidebar-model";

const ROOT = resolve(__dirname, "../..");

function pageExists(href: string) {
  const route = href.split("#")[0].replace(/^\//, "");
  return existsSync(resolve(ROOT, "app", route, "page.tsx"));
}

describe("Architecta navigation", () => {
  it("has 6–8 primary destinations with unique labels and routes", () => {
    expect(ARCHITECTA_NAV_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(ARCHITECTA_NAV_ITEMS.length).toBeLessThanOrEqual(8);
    expect(new Set(ARCHITECTA_NAV_ITEMS.map((item) => item.label)).size).toBe(ARCHITECTA_NAV_ITEMS.length);
    expect(new Set(ARCHITECTA_NAV_ITEMS.map((item) => item.href)).size).toBe(ARCHITECTA_NAV_ITEMS.length);
  });

  it("only links to routes that exist (no hash links into other pages, no dead ends)", () => {
    for (const item of [...ARCHITECTA_NAV_ITEMS, ...ARCHITECTA_SECONDARY_DESTINATIONS]) {
      expect(item.href, item.label).not.toContain("#");
      expect(pageExists(item.href), `${item.label} → ${item.href}`).toBe(true);
    }
  });

  it("keeps placeholder-only areas out of the primary navigation", () => {
    const hrefs = ARCHITECTA_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).not.toContain("/seo");
  });

  it("gives every destination a group and a purpose for the palette", () => {
    for (const item of ARCHITECTA_NAV_ITEMS) {
      expect(item.group, item.label).toBeTruthy();
      expect(item.description, item.label).toBeTruthy();
    }
  });

  it("marks Strategy active on its secondary tools", () => {
    const strategy = ARCHITECTA_NAV_ITEMS.find((item) => item.label === "Strategy")!;
    expect(isNavItemActive("/strategy-engine", strategy)).toBe(true);
    expect(isNavItemActive("/content-strategy", strategy)).toBe(true);
    expect(isNavItemActive("/content-architect", strategy)).toBe(true);
    expect(isNavItemActive("/dashboard", strategy)).toBe(false);
  });

  it("matches nested routes but not look-alike prefixes", () => {
    const create = ARCHITECTA_NAV_ITEMS.find((item) => item.label === "Create")!;
    expect(isNavItemActive("/generate", create)).toBe(true);
    expect(isNavItemActive("/studio", create)).toBe(true);
    expect(isNavItemActive("/generate/abc", create)).toBe(true);
    expect(isNavItemActive("/generated-report", create)).toBe(false);
  });

  it("never marks external links active", () => {
    expect(
      isNavItemActive("/dashboard", {
        ...ARCHITECTA_NAV_ITEMS[0],
        href: "https://entrepreneuria.io",
        external: true,
      })
    ).toBe(false);
  });

  it("appends the ecosystem Command Center after the grouped app items", () => {
    const items = buildSidebarNavigation(ARCHITECTA_NAV_ITEMS, {
      commandCenterHref: "https://entrepreneuria.io/dashboard",
    });
    const last = items[items.length - 1];
    expect(last.label).toBe("Command Center");
    expect(last.external).toBe(true);
    expect(last.group).toBeUndefined();
  });
});
