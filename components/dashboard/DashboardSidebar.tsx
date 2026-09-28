"use client";

import { LayoutDashboard } from "lucide-react";

import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ARCHITECTA_NAV_ITEMS } from "@/lib/navigation/architecta-nav";
import type { SidebarBrand, SidebarUser } from "@/lib/navigation/types";

const architectaBrand: SidebarBrand = {
  appName: "Architecta",
  eyebrow: "Blueprint OS",
  tagline: "Founder growth engine",
  homeHref: "/dashboard",
  logoIcon: LayoutDashboard,
};

type DashboardSidebarProps = {
  user?: SidebarUser | null;
};

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  return (
    <AppSidebar
      brand={architectaBrand}
      navItems={ARCHITECTA_NAV_ITEMS}
      user={user}
    />
  );
}
