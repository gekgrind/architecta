"use client";

import { motion, useReducedMotion } from "framer-motion";

import { BlueprintBackground } from "@/components/dashboard/BlueprintBackground";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { StrategyEngineWorkflow } from "@/components/strategy-engine/strategy-engine-workflow";
import { useAuthIdentity } from "@/hooks/use-auth-identity";

export function StrategyEngineShell() {
  const { avatarUrl, displayName, loading, workspaceName } = useAuthIdentity();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#041C3B] font-[var(--font-inter)] text-white">
      <BlueprintBackground />
      <DashboardSidebar />
      <DashboardTopBar
        avatarUrl={avatarUrl}
        displayName={loading ? "Founder" : displayName}
        workspaceName={workspaceName ?? "Owner & Architect"}
      />

      <main className="relative z-10 min-h-screen px-4 pb-24 pt-28 xl:pl-24 xl:pr-8">
        <motion.div
          initial={shouldReduceMotion ? false : { y: 28, opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-7xl"
        >
          <StrategyEngineWorkflow />
        </motion.div>
      </main>
    </div>
  );
}
