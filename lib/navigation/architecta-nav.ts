import {
  BarChart3,
  CalendarDays,
  Compass,
  LayoutDashboard,
  Library,
  PenTool,
  Target,
  Waypoints,
} from "lucide-react";

import type { SidebarNavigationItem } from "@/lib/navigation/types";

/**
 * Architecta's primary information architecture — the single source of truth
 * for every sidebar in the app (the dashboard/strategy AppSidebar and the
 * DashboardLayout sidebar used by the execution pages).
 *
 * Dashboard   = what matters now
 * Strategy    = where we are going and why
 * Create … Campaigns = doing the work
 * Brand       = what Architecta knows about the business
 * Insights    = what happened
 *
 * Only destinations with a working page are listed. Staged areas (SEO,
 * market intelligence) stay out of the navigation until they exist.
 */
export const ARCHITECTA_NAV_ITEMS: SidebarNavigationItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    group: "Command",
    description: "What needs your attention now",
  },
  {
    icon: Compass,
    label: "Strategy",
    href: "/strategy-engine",
    group: "Command",
    description: "Where your marketing is going and why",
    matchPrefixes: ["/strategy-engine", "/content-strategy", "/content-architect"],
  },
  {
    icon: PenTool,
    label: "Create",
    href: "/generate",
    group: "Execute",
    description: "Generate on-brand content",
    matchPrefixes: ["/generate", "/studio"],
  },
  {
    icon: Library,
    label: "Library",
    href: "/library",
    group: "Execute",
    description: "Drafts, approved posts and assets",
  },
  {
    icon: CalendarDays,
    label: "Calendar",
    href: "/calendar",
    group: "Execute",
    description: "Schedule and publish",
  },
  {
    icon: Waypoints,
    label: "Campaigns",
    href: "/campaigns",
    group: "Execute",
    description: "Multi-post campaigns and launch sequences",
  },
  {
    icon: Target,
    label: "Brand",
    href: "/brand-kit",
    group: "Intelligence",
    description: "Business profile, audience and voice",
  },
  {
    icon: BarChart3,
    label: "Insights",
    href: "/analytics",
    group: "Intelligence",
    description: "Content pipeline and publishing activity",
  },
];

export type ArchitectaDestination = {
  label: string;
  href: string;
  /** Primary destination this tool lives under. */
  parent: string;
  description: string;
};

/**
 * Working tools that live inside a primary destination rather than in the
 * sidebar. Surfaced through the command palette so they stay discoverable.
 */
export const ARCHITECTA_SECONDARY_DESTINATIONS: ArchitectaDestination[] = [
  {
    label: "Content strategy",
    href: "/content-strategy",
    parent: "Strategy",
    description: "Pillars, platforms and a monthly content roadmap",
  },
  {
    label: "Content architecture plan",
    href: "/content-architect",
    parent: "Strategy",
    description: "Weekly themes, post ideas and repurposing",
  },
  {
    label: "Blueprint studio",
    href: "/studio",
    parent: "Create",
    description: "Map a content blueprint on the canvas",
  },
  {
    label: "Settings",
    href: "/settings",
    parent: "Account",
    description: "Connections, AI preferences and usage",
  },
];

export function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

export function isNavItemActive(pathname: string, item: SidebarNavigationItem) {
  if (isExternalHref(item.href) || item.external) {
    return false;
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return (
    item.matchPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? false
  );
}
