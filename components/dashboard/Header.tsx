"use client";

import { motion } from "framer-motion";
import { Icons } from "@/components/icons";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      className="sticky top-0 z-20 backdrop-blur-xl border-b
        bg-blueprint-navy/90 border-blueprint-cyan/20
        dark:bg-blueprint-navy/90
        light:bg-white/80"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between px-8 py-5">
        {/* Left */}
        <div className="flex items-center gap-4">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-blueprint-cyan"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <h2 className="text-2xl font-light text-foreground">
            Dashboard
          </h2>
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-blueprint-cyan/70">
            Control Center
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="text-xs font-mono uppercase tracking-widest
              px-3 py-2 rounded border
              border-blueprint-cyan/40
              text-blueprint-cyan
              hover:border-blueprint-cyan
              transition"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          <div className="relative w-72">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blueprint-cyan/60" />
            <input
              placeholder="Search blueprints…"
              className="w-full pl-10 pr-4 py-2 rounded-lg
                bg-blueprint-panel/80
                border border-blueprint-cyan/30
                text-sm text-foreground
                placeholder:text-blueprint-cyan/40
                focus:outline-none focus:border-blueprint-cyan/60"
            />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
