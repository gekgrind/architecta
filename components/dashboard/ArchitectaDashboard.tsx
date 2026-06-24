"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";

import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { AiUsageCard } from "@/components/dashboard/AiUsageCard";
import { BlueprintBackground } from "@/components/dashboard/BlueprintBackground";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { StrategicOverview } from "@/components/dashboard/StrategicOverview";

export type ArchitectaDashboardIdentity = {
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  title?: string | null;
  workspaceName: string;
};

type ArchitectaDashboardProps = {
  identity: ArchitectaDashboardIdentity;
  preview?: boolean;
};

export function ArchitectaDashboard({ identity, preview = false }: ArchitectaDashboardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#041C3B] font-[var(--font-inter)] text-white">
      <BlueprintBackground />
      <DashboardSidebar
        user={{
          avatarUrl: identity.avatarUrl,
          email: identity.email,
          fullName: identity.displayName,
          title: identity.title ?? identity.workspaceName,
        }}
      />
      <DashboardTopBar />

      {preview ? (
        <div className="fixed bottom-4 right-4 z-[60] rounded-full border border-[#FFE14D]/35 bg-[#041C3B]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFE14D] shadow-[0_0_18px_rgba(255,225,77,0.18)] backdrop-blur">
          Design Preview
        </div>
      ) : null}

      <main className="relative z-10 min-h-screen px-4 pb-32 pt-28 md:pl-[92px] xl:pr-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <motion.div
            initial={shouldReduceMotion ? false : { y: 30, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end"
          >
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#00D4FF]">
                Founder Command Center
              </p>
              <h1 className="font-[var(--font-science-gothic,var(--font-inter))] text-4xl font-bold tracking-tight text-white md:text-5xl">
                Strategic Intelligence
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden -space-x-3 sm:flex">
                {["EF", "AO", "MK", "JL"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#041C3B] bg-[#0B2B57] text-xs font-bold text-white shadow-lg"
                  >
                    {initials}
                  </div>
                ))}
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#041C3B] bg-[#0B2B57] text-xs font-bold text-white shadow-lg transition-colors hover:bg-[#00D4FF] hover:text-[#041C3B]"
                >
                  +8
                </button>
              </div>
              <button
                type="button"
                className="group flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#087EFF] px-6 py-3 font-medium text-white shadow-lg shadow-[#087EFF]/20 transition-all hover:bg-[#087EFF]/90 active:scale-95"
              >
                <Zap size={18} className="group-hover:animate-pulse" />
                New Strategy
              </button>
            </div>
          </motion.div>

          <MetricsGrid />

          <motion.div
            initial={shouldReduceMotion ? false : { y: 48, opacity: 0 }}
            whileInView={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            <StrategicOverview />
            <ActionQueue />
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { y: 48, opacity: 0 }}
            whileInView={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <AiUsageCard />
          </motion.div>

          <IntelligencePanel />
        </div>
      </main>
    </div>
  );
}
