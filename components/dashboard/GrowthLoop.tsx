"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Brain, ChevronRight, Compass, LineChart, PenTool, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { LoopStage } from "@/lib/dashboard/model";
import { cn } from "@/lib/utils";

const STAGE_ICON: Record<LoopStage["id"], LucideIcon> = {
  intelligence: Brain,
  strategy: Compass,
  execution: PenTool,
  performance: LineChart,
};

/** The verb each stage represents in the loop: know → plan → execute → learn. */
const STAGE_VERB: Record<LoopStage["id"], string> = {
  intelligence: "Know",
  strategy: "Plan",
  execution: "Execute",
  performance: "Learn",
};

const STATE_STYLE: Record<LoopStage["state"], { icon: string; chip: string; chipLabel: string }> = {
  established: {
    icon: "text-[#00D4FF]",
    chip: "bg-[#12E070]/10 text-[#12E070]",
    chipLabel: "In place",
  },
  partial: {
    icon: "text-[#FFE14D]",
    chip: "bg-[#FFE14D]/10 text-[#FFE14D]",
    chipLabel: "In progress",
  },
  empty: {
    icon: "text-[#BCC0D8]",
    chip: "bg-white/5 text-[#BCC0D8]",
    chipLabel: "Not started",
  },
  awaiting: {
    icon: "text-[#BCC0D8]",
    chip: "border border-dashed border-white/15 text-[#BCC0D8]",
    chipLabel: "Not tracked",
  },
  unavailable: {
    icon: "text-[#BCC0D8]",
    chip: "bg-white/5 text-[#BCC0D8]",
    chipLabel: "Unavailable",
  },
};

/**
 * The growth loop — intelligence → strategy → execution → performance — with
 * the real state of each stage. Replaces the former decorative KPI cards.
 */
export function GrowthLoop({ stages }: { stages: LoopStage[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section aria-label="Growth loop: know, plan, execute, learn">
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, index) => {
          const Icon = STAGE_ICON[stage.id];
          const style = STATE_STYLE[stage.state];
          const isLast = index === stages.length - 1;

          return (
            <motion.li
              key={stage.id}
              className="relative"
              initial={{ y: 34, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { delay: index * 0.06, duration: 0.45, ease: "easeOut" as const }
              }
            >
              <Link
                href={stage.href}
                aria-label={`${stage.label}: ${stage.value}${stage.unit ? ` ${stage.unit}` : ""}. ${style.chipLabel}. ${stage.caption}`}
                className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF]/70"
              >
                <DashboardCard className="relative h-full overflow-hidden p-5">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00D4FF]/5 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-xs uppercase tracking-tight text-[#BCC0D8]">
                        <span className="font-mono text-[#BCC0D8]/60">0{index + 1}</span> {stage.label}
                        <span className="ml-1.5 font-mono text-[10px] tracking-widest text-[#00D4FF]/70">
                          · {STAGE_VERB[stage.id]}
                        </span>
                      </p>
                      <h2 className="flex flex-wrap items-baseline gap-x-2 font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight text-white">
                        {stage.value}
                        {stage.unit ? (
                          <span className="font-[var(--font-inter)] text-sm font-medium not-italic tracking-normal text-white/80">
                            {stage.unit}
                          </span>
                        ) : null}
                      </h2>
                    </div>
                    <Icon className={cn("h-5 w-5 shrink-0", style.icon)} aria-hidden="true" />
                  </div>
                  <div className="mt-4 flex items-start gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                        style.chip
                      )}
                    >
                      {style.chipLabel}
                    </span>
                    <span className="min-w-0 text-[11px] leading-snug text-[#BCC0D8]">{stage.caption}</span>
                  </div>
                </DashboardCard>
              </Link>
              {!isLast ? (
                <ChevronRight
                  size={14}
                  className="pointer-events-none absolute -right-[19px] top-1/2 hidden -translate-y-1/2 text-[#00D4FF]/40 xl:block"
                  aria-hidden="true"
                />
              ) : null}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
