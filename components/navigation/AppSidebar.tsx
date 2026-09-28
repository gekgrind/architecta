"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftToLine, Menu, X } from "lucide-react";
import Link from "next/link";

import { SidebarNavItem } from "@/components/navigation/SidebarNavItem";
import { SidebarUserMenu } from "@/components/navigation/SidebarUserMenu";
import { getCommandCenterUrl } from "@/lib/config/ecosystem";
import { buildSidebarNavigation } from "@/lib/navigation/sidebar-model";
import type {
  SidebarBrand,
  SidebarNavigationItem,
  SidebarUser,
} from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  brand: SidebarBrand;
  navItems: SidebarNavigationItem[];
  user?: SidebarUser | null;
};

type SidebarContentProps = AppSidebarProps & {
  isExpanded: boolean;
  onNavigate?: () => void;
};

function SidebarContent({ brand, navItems, user, isExpanded, onNavigate }: SidebarContentProps) {
  const navigationItems = useMemo(
    () => buildSidebarNavigation(navItems, { commandCenterHref: getCommandCenterUrl() }),
    [navItems]
  );
  const LogoIcon = brand.logoIcon ?? ArrowLeftToLine;

  return (
    <>
      <div className={cn("px-4", isExpanded ? "pt-6" : "pt-5")}>
        <Link
          href={brand.homeHref ?? "/dashboard"}
          onClick={onNavigate}
          className={cn(
            "group flex items-center rounded-2xl border border-white/5 bg-white/[0.03] transition-all hover:border-[#00D4FF]/20 hover:bg-white/[0.05]",
            isExpanded ? "gap-3 p-3" : "justify-center p-2"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#087EFF] shadow-lg shadow-[#087EFF]/35">
            <LogoIcon className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          {isExpanded ? (
            <div className="min-w-0">
              {brand.eyebrow ? (
                <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#00D4FF]">
                  {brand.eyebrow}
                </p>
              ) : null}
              <p className="truncate font-[var(--font-science-gothic,var(--font-inter))] text-lg font-bold tracking-tight text-white">
                {brand.appName}
              </p>
              {brand.tagline ? (
                <p className="truncate text-[11px] text-[#BCC0D8]">{brand.tagline}</p>
              ) : null}
            </div>
          ) : null}
        </Link>
      </div>

      <nav
        aria-label={`${brand.appName} navigation`}
        className="mt-6 flex-1 space-y-1 overflow-y-auto px-4 pb-4"
      >
        {navigationItems.map((item, index) => {
          const startsGroup = index === 0 || item.group !== navigationItems[index - 1].group;
          const showHeading = isExpanded && startsGroup && Boolean(item.group);
          const showDivider = !showHeading && startsGroup && index > 0;

          return (
            <Fragment key={`${item.label}-${item.href}`}>
              {showHeading ? (
                <p
                  className={cn(
                    "px-4 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#BCC0D8]/60",
                    index > 0 && "pt-4"
                  )}
                >
                  {item.group}
                </p>
              ) : null}
              {showDivider ? <div className="mx-3 my-3 h-px bg-white/5" aria-hidden="true" /> : null}
              <SidebarNavItem item={item} isExpanded={isExpanded} onNavigate={onNavigate} />
            </Fragment>
          );
        })}
      </nav>

      <SidebarUserMenu user={user} isExpanded={isExpanded} />
    </>
  );
}

export function AppSidebar({ brand, navItems, user }: AppSidebarProps) {
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/5 bg-[#041C3B]/85 pb-6 backdrop-blur-md transition-[width] duration-300 motion-reduce:transition-none md:flex",
          desktopExpanded ? "w-72" : "w-[92px]"
        )}
        onMouseEnter={() => setDesktopExpanded(true)}
        onMouseLeave={() => setDesktopExpanded(false)}
        onFocus={() => setDesktopExpanded(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDesktopExpanded(false);
          }
        }}
      >
        <SidebarContent
          brand={brand}
          navItems={navItems}
          user={user}
          isExpanded={desktopExpanded}
        />
      </aside>

      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#041C3B]/90 text-white shadow-2xl shadow-black/30 backdrop-blur-xl transition-colors hover:border-[#00D4FF]/60 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute left-0 top-0 flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[#041C3B] pb-6 shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <SidebarContent
              brand={brand}
              navItems={navItems}
              user={user}
              isExpanded
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
