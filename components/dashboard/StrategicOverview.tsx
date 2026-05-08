"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Brain, Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

export function StrategicOverview() {
  return (
    <DashboardCard title="AI Strategy Blueprint" icon={Brain} className="lg:col-span-2">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <StrategyPhase
            label="Phase 1: Foundation"
            title="Market Infiltration"
            body="AI analysis suggests a 15% gap in the high-end boutique SaaS sector. Deploy SEO clusters 4 through 7."
            accent="text-[#00D4FF] hover:border-[#00D4FF]/30"
          />
          <StrategyPhase
            label="Phase 2: Scale"
            title="Viral Architecture"
            body="Content engine ready for multi-channel distribution. Expected reach: 250k unique founders."
            accent="text-[#FFE14D] hover:border-[#FFE14D]/30"
          />
        </div>

        <div className="relative flex h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#041C3B]/50">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#00D4FF]/10" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#00D4FF]/10" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="flex h-48 w-48 items-center justify-center rounded-full border border-[#00D4FF]/20"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-[#FFE14D]/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#087EFF]/20 backdrop-blur-md">
                <Sparkles className="text-white" />
              </div>
            </div>
          </motion.div>

          <div className="absolute bottom-4 left-6 right-6 flex justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-[#BCC0D8]">Core Efficiency</span>
              <span className="text-sm font-bold text-[#00D4FF]">98.2%</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="font-mono text-[10px] uppercase text-[#BCC0D8]">Risk Factor</span>
              <span className="text-sm font-bold text-[#FFE14D]">LOW</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

function StrategyPhase({
  label,
  title,
  body,
  accent,
}: {
  label: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className={`group relative rounded-2xl border border-white/5 bg-white/5 p-5 transition-all ${accent}`}>
      <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100">
        <ArrowUpRight size={16} />
      </div>
      <p className="mb-2 text-[10px] font-bold uppercase">{label}</p>
      <h3 className="mb-2 text-lg font-medium text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-[#BCC0D8]">{body}</p>
    </div>
  );
}
