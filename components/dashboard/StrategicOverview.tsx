"use client";

import { ArrowRight, ArrowUpRight, Brain } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardModel } from "@/lib/dashboard/model";

type StrategicOverviewProps = {
  strategy: DashboardModel["strategy"];
  knowledge: DashboardModel["knowledge"];
};

const PILLAR_ACCENTS = [
  "text-[#00D4FF] hover:border-[#00D4FF]/30",
  "text-[#FFE14D] hover:border-[#FFE14D]/30",
  "text-[#12E070] hover:border-[#12E070]/30",
];

const LOOP_STEPS = ["Business intelligence", "Strategy", "Actions", "Execution", "Performance"];

export function StrategicOverview({ strategy, knowledge }: StrategicOverviewProps) {
  return (
    <DashboardCard title="AI Strategy Blueprint" icon={Brain} className="lg:col-span-2">
      {strategy.status === "error" ? (
        <p className="text-sm text-[#BCC0D8]">
          Your saved strategies couldn&apos;t be loaded right now. Refresh to try again.
        </p>
      ) : strategy.latest ? (
        <div className="space-y-6">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#BCC0D8]">
              {strategy.latest.kindLabel} · {strategy.latest.createdLabel} ·{" "}
              <span className={strategy.latest.status === "active" ? "text-[#12E070]" : "text-[#FFE14D]"}>
                {strategy.latest.status}
              </span>
            </p>
            <h3 className="text-xl font-medium text-white">{strategy.latest.title}</h3>
            {strategy.latest.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-[#BCC0D8]">{strategy.latest.summary}</p>
            ) : null}
          </div>

          {strategy.latest.pillars.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {strategy.latest.pillars.map((pillar, index) => (
                <StrategyPhase
                  key={pillar.title}
                  label={`Pillar ${index + 1}`}
                  title={pillar.title}
                  body={pillar.description}
                  accent={PILLAR_ACCENTS[index % PILLAR_ACCENTS.length]}
                />
              ))}
            </div>
          ) : null}

          {strategy.latest.focus.length > 0 || strategy.latest.nextMoves.length > 0 ? (
            <div className="grid gap-4 rounded-2xl border border-white/5 bg-[#041C3B]/50 p-5 md:grid-cols-2">
              <StrategyList title="30-day focus" items={strategy.latest.focus} />
              <StrategyList title="Recommended next moves" items={strategy.latest.nextMoves} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
            <p className="text-xs text-[#BCC0D8]">
              {strategy.savedCount > 1
                ? `Latest of ${strategy.savedCount} saved strategies.`
                : "Your only saved strategy."}
            </p>
            <Link
              href="/strategy-engine"
              className="inline-flex items-center gap-1 rounded text-xs text-[#00D4FF] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#00D4FF]/60"
            >
              Open Strategy Engine <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-white">No strategy yet</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#BCC0D8]">
              {knowledge.status === "ready" && knowledge.knownCount > 0
                ? `Architecta already knows ${knowledge.knownCount} of ${knowledge.totalCount} business foundations. Generate a strategy to turn them into pillars, priorities and next moves — this blueprint will show it here.`
                : "Generate a strategy to turn your business profile into pillars, priorities and next moves. This blueprint will show it here."}
            </p>
          </div>

          <ol className="flex flex-wrap items-center gap-2" aria-label="How Architecta works">
            {LOOP_STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span
                  className={
                    index === 0
                      ? "rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3 py-1 text-xs text-[#00D4FF]"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#BCC0D8]"
                  }
                >
                  {step}
                </span>
                {index < LOOP_STEPS.length - 1 ? (
                  <ArrowRight size={12} className="text-[#BCC0D8]/50" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>

          <Link
            href="/strategy-engine"
            className="inline-flex items-center gap-2 rounded-lg bg-[#087EFF] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#087EFF]/20 outline-none transition-all hover:bg-[#087EFF]/90 focus-visible:ring-2 focus-visible:ring-[#00D4FF]/70 active:scale-95"
          >
            Build your strategy <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </DashboardCard>
  );
}

function StrategyList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase text-[#BCC0D8]">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-snug text-white/90">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D4FF]" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
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
        <ArrowUpRight size={16} aria-hidden="true" />
      </div>
      <p className="mb-2 text-[10px] font-bold uppercase">{label}</p>
      <h3 className="mb-2 text-lg font-medium text-white">{title}</h3>
      {body ? <p className="text-sm leading-relaxed text-[#BCC0D8]">{body}</p> : null}
    </div>
  );
}
