"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  trend: "up" | "down";
  trendValue: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}

export default function StatCard({
  title,
  value,
  trend,
  trendValue,
  icon: Icon,
  index,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative overflow-hidden rounded-lg
        bg-blueprint-panel/70 backdrop-blur-md
        border border-blueprint-cyan/25
        hover:border-blueprint-cyan/60
        transition-all duration-300"
    >
      {/* Blueprint corner accent */}
      <div className="absolute top-0 right-0 w-16 h-16">
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-blueprint-cyan/40" />
      </div>

      <div className="relative p-6 space-y-4">
        {/* Icon */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-blueprint-cyan/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-blueprint-cyan" />
          </div>

          {/* Trend indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              trend === "up"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            <svg
              className={`w-3 h-3 ${trend === "down" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <span className="text-xs font-mono font-medium">{trendValue}</span>
          </div>
        </div>

        {/* Value */}
        <div className="space-y-1">
          <p className="text-3xl font-light text-foreground group-hover:text-blueprint-cyan transition-colors">
            {value}
          </p>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {title}
          </p>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blueprint-cyan/40 to-transparent" />
      </div>
    </motion.div>
  );
}
