"use client";

import {
  BarChart3,
  Globe,
  LayoutDashboard,
  PenTool,
  Rocket,
  Search,
  Target,
  Users,
  Waypoints,
  Zap,
} from "lucide-react";

import { AppSidebar } from "@/components/navigation/AppSidebar";
import type {
  SidebarBrand,
  SidebarNavigationItem,
  SidebarUser,
} from "@/lib/navigation/types";

const architectaBrand: SidebarBrand = {
  appName: "Architecta",
  eyebrow: "Blueprint OS",
  tagline: "AI content studio",
  homeHref: "/dashboard",
  logoIcon: LayoutDashboard,
};

const architectaNavItems: SidebarNavigationItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Zap, label: "Strategy Engine", href: "/content-strategy" },
  { icon: PenTool, label: "Content Architect", href: "/studio" },
  { icon: Target, label: "Brand Positioning", href: "/brand-kit" },
  { icon: Users, label: "Audience Intelligence", href: "/analytics" },
  { icon: Globe, label: "SEO Blueprint", href: "/seo" },
  { icon: Waypoints, label: "Funnel Architect", href: "/campaigns" },
  { icon: Search, label: "Competitor Intel", href: "/analytics#competitor-intel" },
  { icon: Rocket, label: "AI Campaigns", href: "/campaigns#ai-campaigns" },
  { icon: BarChart3, label: "Insights", href: "/analytics#insights" },
];

type DashboardSidebarProps = {
  user?: SidebarUser | null;
};

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  return (
    <AppSidebar
      brand={architectaBrand}
      navItems={architectaNavItems}
      user={user}
    />
  );
}
