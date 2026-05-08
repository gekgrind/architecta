"use client";

import { motion } from "framer-motion";
import { Bell, LayoutGrid, Search } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type DashboardTopBarProps = {
  avatarUrl?: string | null;
  displayName: string;
  workspaceName: string;
};

export function DashboardTopBar({ avatarUrl, displayName, workspaceName }: DashboardTopBarProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed left-4 right-4 top-4 z-50 h-16 xl:left-72"
    >
      <div className="flex h-full w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#0B2B57]/40 px-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-6">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 sm:min-w-[200px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#087EFF] shadow-lg shadow-[#087EFF]/40">
            <LayoutGrid className="h-5 w-5 text-white" />
          </div>
          <span className="hidden font-[var(--font-science-gothic,var(--font-inter))] text-xl font-bold tracking-tight text-white sm:block">
            ARCHITECTA
          </span>
        </Link>

        <div className="relative mx-auto hidden max-w-2xl flex-1 group md:block">
          <div className="absolute inset-0 rounded-full bg-[#00D4FF]/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
          <label className="relative flex items-center rounded-full border border-white/5 bg-[#041C3B]/50 px-5 py-2 transition-all group-hover:border-[#00D4FF]/30">
            <Search className="h-4 w-4 text-[#BCC0D8]" />
            <input
              type="text"
              aria-label="AI strategy search"
              placeholder="Ask AI to architect a growth strategy..."
              className="flex-1 border-none bg-transparent px-3 text-sm text-white outline-none placeholder:text-[#BCC0D8]/50"
            />
            <div className="flex gap-2">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#BCC0D8]">
                Ctrl
              </kbd>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#BCC0D8]">
                K
              </kbd>
            </div>
          </label>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-full p-2 transition-colors hover:bg-white/5"
          >
            <Bell className="h-5 w-5 text-[#BCC0D8] transition-colors hover:text-white" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-[#041C3B] bg-[#00D4FF] shadow-[0_0_5px_#00D4FF]" />
          </button>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <Link href="/settings" className="group flex items-center gap-3 pl-1">
            <div className="hidden text-right sm:block">
              <p className="max-w-36 truncate text-xs font-semibold text-white transition-colors group-hover:text-[#00D4FF]">
                {displayName}
              </p>
              <p className="max-w-36 truncate text-[10px] text-[#BCC0D8]">{workspaceName}</p>
            </div>
            <Avatar className="h-10 w-10 rounded-xl border-2 border-[#00D4FF]/20 p-0.5 transition-all group-hover:border-[#00D4FF]">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="rounded-lg bg-[#0B2B57] text-sm font-semibold text-white">
                {displayName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
