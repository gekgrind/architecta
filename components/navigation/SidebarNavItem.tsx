"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SidebarNavigationItem } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  item: SidebarNavigationItem;
  isExpanded: boolean;
  onNavigate?: () => void;
};

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

function isActivePath(pathname: string, item: SidebarNavigationItem) {
  if (isExternalHref(item.href) || item.external) {
    return false;
  }

  if (pathname === item.href) {
    return true;
  }

  return item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false;
}

export function SidebarNavItem({ item, isExpanded, onNavigate }: SidebarNavItemProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item);
  const className = cn(
    "group relative flex w-full items-center rounded-xl text-sm font-medium transition-all duration-300",
    isExpanded ? "gap-3 px-4 py-3" : "justify-center px-0 py-3",
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
        aria-hidden="true"
      />
      {isExpanded ? <span className="truncate">{item.label}</span> : null}
      {isActive && isExpanded ? (
        <motion.div
          layoutId="entrepreneuria-active-sidebar-pill"
          className="ml-auto h-4 w-1 rounded-full bg-[#00D4FF] shadow-[0_0_10px_#00D4FF]"
        />
      ) : null}
      {!isExpanded ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#041C3B] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      ) : null}
    </>
  );

  if (isExternalHref(item.href) || item.external) {
    return (
      <motion.a
        href={item.href}
        whileHover={{ x: isExpanded ? 4 : 0 }}
        className={className}
        onClick={onNavigate}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.div whileHover={{ x: isExpanded ? 4 : 0 }}>
      <Link href={item.href} className={className} onClick={onNavigate}>
        {content}
      </Link>
    </motion.div>
  );
}
