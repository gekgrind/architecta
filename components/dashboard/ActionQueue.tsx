"use client";

import { motion } from "framer-motion";
import { ChevronRight, Zap } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

const actions = [
  { task: "Approve SEO Blueprint v2", priority: "High" },
  { task: "Deploy Audience Intelligence", priority: "Auto" },
  { task: "Competitor Alert: X-Corp Shift", priority: "Urgent" },
  { task: "Brand Voice Calibration", priority: "Med" },
  { task: "Finalize Pricing Architecture", priority: "High" },
];

export function ActionQueue() {
  return (
    <DashboardCard title="Action Queue" icon={Zap}>
      <div className="space-y-4">
        {actions.map((item) => (
          <motion.div
            key={item.task}
            whileHover={{ x: 4 }}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 transition-all hover:border-white/10"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#041C3B]">
                <div className="h-2 w-2 rounded-full bg-[#00D4FF]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white transition-colors group-hover:text-[#00D4FF]">
                  {item.task}
                </p>
                <p className="text-[10px] uppercase text-[#BCC0D8]">{item.priority} Priority</p>
              </div>
            </div>
            <ChevronRight size={14} className="shrink-0 text-[#BCC0D8] transition-transform group-hover:translate-x-1" />
          </motion.div>
        ))}

        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-dashed border-white/10 py-3 text-xs text-[#BCC0D8] transition-all hover:border-[#00D4FF]/50 hover:text-white"
        >
          + View Strategy Roadmap
        </button>
      </div>
    </DashboardCard>
  );
}
