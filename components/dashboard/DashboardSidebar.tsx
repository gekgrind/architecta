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
<<<<<<< HEAD
import Link from "next/link";
import { usePathname } from "next/navigation";
=======
>>>>>>> 0b07735f6169930c8d8cc15b622e31bd754f21d0

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
  { icon: Zap, label: "Strategy Engine", href: "/strategy-engine" },
  { icon: PenTool, label: "Content Architect", href: "/studio" },
  { icon: Target, label: "Brand Positioning", href: "/brand-kit" },
  { icon: Users, label: "Audience Intelligence", href: "/analytics" },
  { icon: Globe, label: "SEO Blueprint", href: "/seo" },
  { icon: Waypoints, label: "Funnel Architect", href: "/campaigns" },
  { icon: Search, label: "Competitor Intel", href: "/analytics#competitor-intel" },
  { icon: Rocket, label: "AI Campaigns", href: "/campaigns#ai-campaigns" },
  { icon: BarChart3, label: "Insights", href: "/analytics#insights" },
];

<<<<<<< HEAD
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-24 flex-col overflow-hidden border-r border-white/5 bg-[#041C3B]/80 pb-6 pt-24 backdrop-blur-md transition-[width,box-shadow] duration-300 ease-out motion-reduce:transition-none hover:w-72 focus-within:w-72 xl:flex">
        <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const className = cn(
              "group flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 motion-reduce:transition-none group-hover/sidebar:justify-start group-hover/sidebar:px-4 group-focus-within/sidebar:justify-start group-focus-within/sidebar:px-4",
              isActive
                ? "border border-[#00D4FF]/20 bg-[#087EFF]/10 text-[#00D4FF]"
                : "text-[#BCC0D8] hover:bg-white/5 hover:text-white"
            );

            const content = (
              <>
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-[#00D4FF]" : "text-[#BCC0D8] group-hover:text-[#00D4FF]"
                  )}
                />
                <span className="w-0 truncate opacity-0 transition-[width,opacity] duration-300 motion-reduce:transition-none group-hover/sidebar:w-40 group-hover/sidebar:opacity-100 group-focus-within/sidebar:w-40 group-focus-within/sidebar:opacity-100">
                  {item.label}
                </span>
                {isActive ? (
                  <motion.div
                    layoutId="architecta-active-pill"
                    className="ml-auto hidden h-4 w-1 shrink-0 rounded-full bg-[#00D4FF] shadow-[0_0_10px_#00D4FF] group-hover/sidebar:block group-focus-within/sidebar:block"
                  />
                ) : null}
              </>
            );

            if (item.href.startsWith("http")) {
              return (
                <motion.a
                  key={item.label}
                  href={item.href}
                  whileHover={{ x: 4 }}
                  className={className}
                  title={item.label}
                  aria-label={item.label}
                >
                  {content}
                </motion.a>
              );
            }

            return (
              <motion.div key={item.label} whileHover={{ x: 4 }}>
                <Link href={item.href} className={className} title={item.label} aria-label={item.label}>
                  {content}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="mt-auto px-3 transition-all duration-300 motion-reduce:transition-none group-hover/sidebar:px-6 group-focus-within/sidebar:px-6">
          <div className="space-y-3 overflow-hidden rounded-2xl border border-[#00D4FF]/20 bg-[#0B2B57]/60 p-3 text-center transition-all duration-300 motion-reduce:transition-none group-hover/sidebar:p-4 group-focus-within/sidebar:p-4">
            <p className="h-0 overflow-hidden text-xs text-[#BCC0D8] opacity-0 transition-[height,opacity] duration-300 motion-reduce:transition-none group-hover/sidebar:h-4 group-hover/sidebar:opacity-100 group-focus-within/sidebar:h-4 group-focus-within/sidebar:opacity-100">
              Enterprise Plan
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#041C3B]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "85%" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-[#00D4FF] shadow-[0_0_10px_#00D4FF]"
              />
            </div>
            <p className="h-0 overflow-hidden text-[10px] font-bold uppercase tracking-widest text-[#00D4FF] opacity-0 transition-[height,opacity] duration-300 motion-reduce:transition-none group-hover/sidebar:h-4 group-hover/sidebar:opacity-100 group-focus-within/sidebar:h-4 group-focus-within/sidebar:opacity-100">
              Architect Status: Level 5
            </p>
          </div>
        </div>
      </aside>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#041C3B]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_45px_rgba(0,0,0,0.32)] backdrop-blur-xl xl:hidden"
      >
        <ul className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const className = cn(
              "flex min-w-20 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-[10px] font-medium transition-colors",
              isActive
                ? "border-[#00D4FF]/25 bg-[#087EFF]/12 text-[#00D4FF]"
                : "border-transparent text-[#BCC0D8] hover:bg-white/5 hover:text-white"
            );

            const content = (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-20 truncate">{item.label}</span>
              </>
            );

            return (
              <li key={item.label}>
                {item.href.startsWith("http") ? (
                  <a href={item.href} className={className} title={item.label} aria-label={item.label}>
                    {content}
                  </a>
                ) : (
                  <Link href={item.href} className={className} title={item.label} aria-label={item.label}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
=======
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
>>>>>>> 0b07735f6169930c8d8cc15b622e31bd754f21d0
  );
}
