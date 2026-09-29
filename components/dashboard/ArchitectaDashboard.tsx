"use client";

import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { AlertTriangle, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { BlueprintBackground } from "@/components/dashboard/BlueprintBackground";
import { BusinessIntelligence } from "@/components/dashboard/BusinessIntelligence";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { GrowthLoop } from "@/components/dashboard/GrowthLoop";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { StrategicOverview } from "@/components/dashboard/StrategicOverview";
import { WebsiteSignals } from "@/components/dashboard/WebsiteSignals";
import type { DashboardResult } from "@/lib/dashboard/model";

export type ArchitectaDashboardIdentity = {
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  title?: string | null;
  workspaceName: string;
};

type ArchitectaDashboardProps = {
  identity: ArchitectaDashboardIdentity;
  dashboard: DashboardResult;
  preview?: boolean;
};

export function ArchitectaDashboard({ identity, dashboard, preview = false }: ArchitectaDashboardProps) {
  const shouldReduceMotion = useReducedMotion();
  const model = dashboard.status === "ready" ? dashboard.model : null;
  const businessLine = model
    ? [model.business.name, model.business.industry].filter(Boolean).join(" · ")
    : "";
  const activeStrategy = model?.strategy.status === "ready" ? model.strategy.latest : null;
  // Only offer "Create" when strategies loaded and none exist; an unknown state
  // still opens the Strategy workspace without claiming either way.
  const needsStrategy = model?.strategy.status === "ready" && !model.strategy.latest;

  // `initial` must match between server and client render: a reduced-motion
  // client that skipped it would keep the server's hidden styles forever.
  // Reduced motion instead resolves instantly, without movement.
  const reveal: MotionProps = {
    initial: { y: 48, opacity: 0 },
    whileInView: { y: 0, opacity: 1 },
    viewport: { once: true, margin: "-100px" },
    transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" },
  };

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
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" as const }}
            className="mb-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-10"
          >
            <div className="min-w-0">
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#00D4FF]">
                Founder Command Center
              </p>
              <h1 className="font-[var(--font-science-gothic,var(--font-inter))] text-4xl font-bold tracking-tight text-white md:text-5xl">
                Strategic Intelligence
              </h1>
              {businessLine ? (
                <p className="mt-3 text-sm font-medium text-white/90">{businessLine}</p>
              ) : null}
              {model?.business.description ? (
                <p className="mt-1 line-clamp-2 max-w-[62ch] text-sm leading-relaxed text-[#BCC0D8]">
                  {model.business.description}
                </p>
              ) : model && !businessLine ? (
                <p className="mt-3 max-w-[62ch] text-sm text-[#BCC0D8]">
                  Add your business details so Architecta can tailor this command center to you.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-2.5 md:items-end md:border-l md:border-white/10 md:py-1 md:pl-8">
              {activeStrategy ? (
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#BCC0D8] md:text-right">
                  {activeStrategy.kindLabel} ·{" "}
                  <span className={activeStrategy.isActive ? "text-[#12E070]" : "text-[#FFE14D]"}>
                    {activeStrategy.statusLabel}
                  </span>
                  {activeStrategy.createdLabel ? ` · ${activeStrategy.createdLabel}` : null}
                </p>
              ) : null}
              {needsStrategy ? (
                <Link
                  href="/strategy-engine"
                  className="group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#087EFF] px-6 py-3 font-medium text-white shadow-lg shadow-[#087EFF]/20 outline-none transition-all hover:bg-[#087EFF]/90 focus-visible:ring-2 focus-visible:ring-[#00D4FF]/70 active:scale-95"
                >
                  <Zap size={18} className="group-hover:animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                  Create Strategy
                </Link>
              ) : (
                <Link
                  href="/strategy-engine"
                  className="group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#00D4FF]/30 bg-[#087EFF]/15 px-5 py-2.5 text-sm font-medium text-white outline-none transition-all hover:border-[#00D4FF]/60 hover:bg-[#087EFF]/25 focus-visible:ring-2 focus-visible:ring-[#00D4FF]/70 active:scale-95"
                >
                  Open Strategy
                  <ArrowRight
                    size={16}
                    className="text-[#00D4FF] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </div>
          </motion.div>

          {model ? (
            <>
              <GrowthLoop stages={model.loop} />

              <motion.div {...reveal} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <StrategicOverview strategy={model.strategy} knowledge={model.knowledge} />
                <ActionQueue actions={model.actions} />
              </motion.div>

              <motion.div {...reveal} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <BusinessIntelligence knowledge={model.knowledge} />
                <WebsiteSignals analysis={model.websiteAnalysis} />
              </motion.div>

              <motion.div {...reveal}>
                <PerformancePanel
                  execution={model.execution}
                  publishing={model.publishing}
                  campaigns={model.campaigns}
                />
              </motion.div>
            </>
          ) : (
            <DashboardCard title="Workspace unavailable" icon={AlertTriangle}>
              <p className="text-sm text-[#BCC0D8]">
                {dashboard.status === "error"
                  ? dashboard.message
                  : "Architecta couldn't load your workspace right now. Refresh to try again."}
              </p>
            </DashboardCard>
          )}
        </div>
      </main>
    </div>
  );
}
