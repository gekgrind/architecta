"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardAction } from "@/lib/dashboard/model";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<DashboardAction["source"], string> = {
  profile: "Business profile",
  strategy: "Strategy",
  content: "Content",
  publishing: "Publishing",
  setup: "Setup",
};

export function ActionQueue({ actions }: { actions: DashboardAction[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <DashboardCard title="Action Queue" icon={Zap}>
      {actions.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-white/10 p-4">
          <CheckCircle2 size={18} className="text-[#12E070]" aria-hidden="true" />
          <p className="text-sm text-white">Nothing needs your attention right now.</p>
          <p className="text-xs leading-relaxed text-[#BCC0D8]">
            New actions appear here as your profile, strategy, content and publishing change.
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5" aria-label="Recommended next actions, most urgent first">
          {actions.map((action) => {
            const high = action.priority === "high";
            return (
              <motion.li key={action.id} whileHover={shouldReduceMotion ? undefined : { x: 4 }}>
                <Link
                  href={action.href}
                  className={cn(
                    "group relative block overflow-hidden rounded-xl border bg-white/5 py-3 pl-4 pr-3 outline-none transition-all hover:border-white/15 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-[#00D4FF]/60",
                    high ? "border-[#FFE14D]/20" : "border-white/5"
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5",
                      high ? "bg-[#FFE14D]" : "bg-[#00D4FF]/40"
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium leading-snug text-white transition-colors group-hover:text-[#00D4FF]">
                    {action.title}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-[#BCC0D8]">{action.reason}</p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <p className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-[#BCC0D8]/70">
                      {high ? (
                        <span className="rounded-full bg-[#FFE14D]/10 px-1.5 py-px font-bold text-[#FFE14D]">
                          High priority
                        </span>
                      ) : null}
                      <span>{SOURCE_LABEL[action.source]}</span>
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#00D4FF]">
                      {action.cta}
                      <ArrowRight
                        size={12}
                        className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ol>
      )}
    </DashboardCard>
  );
}
