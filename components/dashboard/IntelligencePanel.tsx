"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

const reachData = [35, 45, 30, 60, 85, 40, 55, 75, 45, 65, 80, 95];

export function IntelligencePanel() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <DashboardCard title="Live Opportunity Feed" icon={BarChart3} className="h-full">
        <div className="space-y-6">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="relative pl-6 before:absolute before:bottom-0 before:left-0 before:top-2 before:w-px before:bg-white/10"
            >
              <div className="absolute left-[-4px] top-1.5 h-2 w-2 rounded-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]" />
              <p className="mb-1 font-mono text-[10px] uppercase text-[#BCC0D8]">09:42:15 UTC</p>
              <p className="text-sm leading-snug text-white">
                AI identified a <span className="font-bold text-[#12E070]">surging demand</span> in founder operating
                systems. Recommend positioning shift.
              </p>
            </div>
          ))}

          <div className="rounded-2xl border border-[#12E070]/10 bg-[#12E070]/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-[#12E070]" />
              <span className="text-[10px] font-bold uppercase text-[#12E070]">AI Recommendation</span>
            </div>
            <p className="text-xs italic text-white/80">
              Current market momentum favors a solopreneur scaling narrative across content, SEO, and funnel assets.
            </p>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="Organic Reach Evolution" icon={Activity} className="lg:col-span-2">
        <div className="relative flex h-[240px] w-full items-end gap-2 px-2">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-2 opacity-10">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-px w-full bg-white" />
            ))}
          </div>

          {reachData.map((height, index) => (
            <div key={`${height}-${index}`} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${height}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + index * 0.04, duration: 0.7, ease: "easeOut" }}
                className="relative w-full rounded-t-sm bg-gradient-to-t from-[#087EFF] to-[#00D4FF] opacity-60 transition-opacity group-hover:opacity-100"
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="font-mono text-[10px] font-bold text-[#00D4FF]">{height}k</span>
                </div>
              </motion.div>
              <span className="mt-2 font-mono text-[9px] text-[#BCC0D8]">Q{(index % 4) + 1}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex gap-6">
            <Legend color="bg-[#087EFF]" label="Projected" />
            <Legend color="bg-[#00D4FF]" label="Actual" />
          </div>
          <button type="button" className="text-xs text-[#00D4FF] transition-all hover:underline">
            Detailed Analytics Report
          </button>
        </div>
      </DashboardCard>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] uppercase text-[#BCC0D8]">{label}</span>
    </div>
  );
}
