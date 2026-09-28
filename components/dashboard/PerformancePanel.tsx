"use client";

import { Activity, ArrowRight, ChevronRight, LineChart } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardModel } from "@/lib/dashboard/model";
import { cn } from "@/lib/utils";

type PerformancePanelProps = {
  execution: DashboardModel["execution"];
  publishing: DashboardModel["publishing"];
  campaigns: DashboardModel["campaigns"];
};

/**
 * What Architecta can actually measure today: its own content pipeline and
 * publish attempts. Reach and engagement are not collected, so they get an
 * honest empty state instead of a chart.
 */
export function PerformancePanel({ execution, publishing, campaigns }: PerformancePanelProps) {
  const pipeline = [
    { label: "Ideas", value: execution.ideas },
    { label: "Drafts", value: execution.drafts },
    { label: "Approved", value: execution.approved },
    { label: "Scheduled", value: execution.scheduled },
    { label: "Published", value: execution.published },
  ];
  const maxStage = Math.max(...pipeline.map((stage) => stage.value));

  return (
    <DashboardCard title="Performance" icon={Activity}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section aria-label="Content pipeline">
            <p className="mb-3 font-mono text-[10px] uppercase text-[#BCC0D8]">Content pipeline</p>
            {execution.status === "error" ? (
              <p className="text-sm text-[#BCC0D8]">Content couldn&apos;t be loaded right now.</p>
            ) : (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-0">
                {pipeline.map((stage, index) => {
                  const isLast = index === pipeline.length - 1;
                  // Bar length is relative to the largest real stage count — a
                  // visual of the user's own pipeline, not a projection.
                  const share = maxStage > 0 ? stage.value / maxStage : 0;
                  return (
                    <li
                      key={stage.label}
                      className={cn(
                        "relative rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:rounded-none sm:border-y sm:border-l-0 sm:border-r-0",
                        index === 0 && "sm:rounded-l-xl sm:border-l",
                        isLast && "sm:rounded-r-xl sm:border-r"
                      )}
                    >
                      <p className="font-mono text-[10px] uppercase text-[#BCC0D8]">{stage.label}</p>
                      <p
                        className={cn(
                          "mt-1 font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight",
                          stage.value > 0 ? "text-white" : "text-white/40"
                        )}
                      >
                        {stage.value}
                      </p>
                      <div className="mt-2 h-1 rounded-full bg-white/5" aria-hidden="true">
                        <div
                          className={cn("h-full rounded-full", isLast ? "bg-[#12E070]" : "bg-[#00D4FF]/70")}
                          style={{ width: stage.value > 0 ? `${Math.max(share * 100, 6)}%` : "0%" }}
                        />
                      </div>
                      {!isLast ? (
                        <ChevronRight
                          size={14}
                          className="absolute -right-[7px] top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-[#0B2B57] text-[#00D4FF]/60 sm:block"
                          aria-hidden="true"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-label="Publishing" className="grid gap-4 border-t border-white/5 pt-5 sm:grid-cols-3">
            <Fact
              label="Published · 30 days"
              value={publishing.status === "error" ? "—" : String(publishing.successes30d)}
            />
            <Fact
              label="Failed · 30 days"
              value={publishing.status === "error" ? "—" : String(publishing.failures30d)}
              warn={publishing.status === "ready" && publishing.failures30d > 0}
            />
            <Fact
              label="Active campaigns"
              value={campaigns.status === "error" ? "—" : String(campaigns.active)}
            />
            <div className="sm:col-span-3">
              <p className="font-mono text-[10px] uppercase text-[#BCC0D8]">Next scheduled</p>
              <p className="mt-1 text-sm text-white">
                {execution.status === "error"
                  ? "—"
                  : execution.nextScheduled
                    ? `${execution.nextScheduled.title}${execution.nextScheduled.platform ? ` · ${execution.nextScheduled.platform}` : ""} · ${execution.nextScheduled.label}`
                    : "Nothing scheduled"}
              </p>
            </div>
          </section>
        </div>

        <section
          aria-label="Reach and engagement"
          className="flex flex-col justify-between gap-5 rounded-2xl border border-dashed border-white/10 bg-[#041C3B]/50 p-5"
        >
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-lg bg-[#00D4FF]/10 p-2 text-[#00D4FF]">
                <LineChart size={16} aria-hidden="true" />
              </div>
              <span className="rounded-full border border-dashed border-white/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#BCC0D8]">
                Not connected
              </span>
            </div>
            <p className="text-sm font-medium text-white">Reach &amp; engagement</p>
            <p className="mt-2 text-xs leading-relaxed text-[#BCC0D8]">
              {execution.status === "ready" && execution.published > 0
                ? "Architecta records what it publishes, but doesn't collect reach or engagement from your channels yet. Those insights will appear here once it does."
                : "Performance insights will appear after Architecta has campaign or publishing data to analyze."}
            </p>
          </div>
          <Link
            href={execution.status === "ready" && execution.published > 0 ? "/analytics" : "/calendar"}
            className="inline-flex items-center gap-1 self-start rounded text-xs font-medium text-[#00D4FF] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#00D4FF]/60"
          >
            {execution.status === "ready" && execution.published > 0 ? "Open Insights" : "Schedule content"}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </DashboardCard>
  );
}

function Fact({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-[#BCC0D8]">{label}</p>
      <p className={warn ? "mt-1 text-lg font-bold text-[#FFE14D]" : "mt-1 text-lg font-bold text-white"}>
        {value}
      </p>
    </div>
  );
}
