"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Globe,
  LayoutDashboard,
  PenTool,
  Rocket,
  Search,
  Settings,
  Target,
  Users,
  Waypoints,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Zap, label: "Strategy Engine", href: "/content-strategy" },
  { icon: PenTool, label: "Content Architect", href: "/studio" },
  { icon: Target, label: "Brand Positioning", href: "/brand-kit" },
  { icon: Users, label: "Audience Intelligence", href: "/analytics" },
  { icon: Globe, label: "SEO Blueprint", href: "/seo" },
  { icon: Waypoints, label: "Funnel Architect", href: "/campaigns" },
  { icon: Search, label: "Competitor Intel", href: "/analytics" },
  { icon: Rocket, label: "AI Campaigns", href: "/campaigns" },
  { icon: BarChart3, label: "Insights", href: "/analytics" },
  { icon: Settings, label: "Command Center", href: "https://entrepreneuria.io/dashboard" },
];

export function DashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-white/5 bg-[#041C3B]/80 pb-6 pt-24 backdrop-blur-md xl:flex">
      <nav className="flex-1 space-y-1 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === "Dashboard";
          const className = cn(
            "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300",
            isActive
              ? "border border-[#00D4FF]/20 bg-[#087EFF]/10 text-[#00D4FF]"
              : "text-[#BCC0D8] hover:bg-white/5 hover:text-white"
          );

          const content = (
            <>
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-[#00D4FF]" : "text-[#BCC0D8] group-hover:text-[#00D4FF]"
                )}
              />
              <span>{item.label}</span>
              {isActive ? (
                <motion.div
                  layoutId="architecta-active-pill"
                  className="ml-auto h-4 w-1 rounded-full bg-[#00D4FF] shadow-[0_0_10px_#00D4FF]"
                />
              ) : null}
            </>
          );

          if (item.href.startsWith("http")) {
            return (
              <motion.a key={item.label} href={item.href} whileHover={{ x: 4 }} className={className}>
                {content}
              </motion.a>
            );
          }

          return (
            <motion.div key={item.label} whileHover={{ x: 4 }}>
              <Link href={item.href} className={className}>
                {content}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="mt-auto px-6">
        <div className="space-y-3 rounded-2xl border border-[#00D4FF]/20 bg-[#0B2B57]/60 p-4 text-center">
          <p className="text-xs text-[#BCC0D8]">Enterprise Plan</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#041C3B]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full bg-[#00D4FF] shadow-[0_0_10px_#00D4FF]"
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">
            Architect Status: Level 5
          </p>
        </div>
      </div>
    </aside>
  );
}
