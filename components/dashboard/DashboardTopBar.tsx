"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Search } from "lucide-react";
import Link from "next/link";

import { CommandPalette } from "@/components/navigation/CommandPalette";

export function DashboardTopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed left-4 right-4 top-4 z-50 h-16 md:left-[92px]"
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
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            className="relative flex w-full items-center rounded-full border border-white/5 bg-[#041C3B]/50 px-5 py-2 text-left outline-none transition-all group-hover:border-[#00D4FF]/30 focus-visible:border-[#00D4FF]/60 focus-visible:ring-2 focus-visible:ring-[#00D4FF]/30"
          >
            <Search className="h-4 w-4 text-[#BCC0D8]" aria-hidden="true" />
            <span className="flex-1 px-3 text-sm text-[#BCC0D8]/50">
              Jump to strategy, content, calendar…
            </span>
            <span className="flex gap-2" aria-hidden="true">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#BCC0D8]">
                Ctrl
              </kbd>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#BCC0D8]">
                K
              </kbd>
            </span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-4 md:hidden">
          <button
            type="button"
            aria-label="Jump to a workspace"
            onClick={() => setPaletteOpen(true)}
            className="rounded-full p-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF]/50"
          >
            <Search className="h-5 w-5 text-[#BCC0D8]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </motion.header>
  );
}
