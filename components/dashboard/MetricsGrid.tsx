"use client";

import { motion } from "framer-motion";
import { Activity, Target, TrendingUp, Users, type LucideIcon } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
};

const metrics: Metric[] = [
  { label: "Growth Blueprint", value: "78%", change: "+12%", icon: TrendingUp, color: "text-[#00D4FF]" },
  { label: "Brand Alignment", value: "94/100", change: "+2", icon: Target, color: "text-[#FFE14D]" },
  { label: "Audience Insight", value: "128k", change: "+18k", icon: Users, color: "text-[#12E070]" },
  { label: "Market Signals", value: "Active", change: "8 Alerts", icon: Activity, color: "text-[#087EFF]" },
];

export function MetricsGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;

        return (
          <motion.div
            key={metric.label}
            initial={{ y: 34, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: index * 0.06, duration: 0.45, ease: "easeOut" }}
          >
            <DashboardCard className="relative overflow-hidden p-5">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00D4FF]/5 blur-2xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-tight text-[#BCC0D8]">{metric.label}</p>
                  <h2 className="font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight text-white">
                    {metric.value}
                  </h2>
                </div>
                <Icon className={cn("h-5 w-5", metric.color)} />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-[#12E070]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#12E070]">
                  {metric.change}
                </span>
                <span className="text-[10px] text-[#BCC0D8]">vs previous orbit</span>
              </div>
            </DashboardCard>
          </motion.div>
        );
      })}
    </div>
  );
}
