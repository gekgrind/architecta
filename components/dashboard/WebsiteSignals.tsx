"use client";

import { Globe, Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardWebsiteAnalysis } from "@/lib/dashboard/model";

/**
 * Positioning signals extracted from the business website during onboarding.
 * A dated snapshot — not live market monitoring — and labelled as such.
 */
export function WebsiteSignals({ analysis }: { analysis: DashboardWebsiteAnalysis }) {
  const hasSignals =
    analysis.differentiators.length + analysis.topics.length + analysis.ctaPatterns.length > 0;

  return (
    <DashboardCard title="Website Signals" icon={Globe} className="h-full">
      {analysis.status === "completed" && hasSignals ? (
        <div className="space-y-6">
          <p className="font-mono text-[10px] uppercase text-[#BCC0D8]">
            {[
              "Website analysis",
              analysis.domain,
              analysis.analyzedLabel ? `Analyzed ${analysis.analyzedLabel}` : null,
              analysis.confidence ? `${analysis.confidence} confidence` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <SignalGroup title="What sets you apart" items={analysis.differentiators} />
          <SignalGroup title="Topics your site covers" items={analysis.topics} />
          <SignalGroup title="Calls to action in use" items={analysis.ctaPatterns} />

          <div className="rounded-2xl border border-[#12E070]/10 bg-[#12E070]/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-[#12E070]" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase text-[#12E070]">Snapshot</span>
            </div>
            <p className="text-xs text-white/80">
              Captured once from your website during onboarding. Architecta does not monitor your
              site or market continuously yet.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[#BCC0D8]">{emptyMessage(analysis)}</p>
      )}
    </DashboardCard>
  );
}

function emptyMessage(analysis: DashboardWebsiteAnalysis) {
  switch (analysis.status) {
    case "pending":
      return "Your website analysis is still running. Positioning signals will appear here when it completes.";
    case "failed":
      return `The analysis of ${analysis.domain ?? "your website"} didn't complete, so no positioning signals were extracted.`;
    case "error":
      return "Website signals couldn't be loaded right now. Refresh to try again.";
    case "completed":
      return "The website analysis finished but didn't surface clear differentiators, topics or calls to action.";
    default:
      return "Architecta hasn't analyzed a website for this business, so there are no positioning signals yet.";
  }
}

function SignalGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="relative pl-6 before:absolute before:bottom-0 before:left-0 before:top-2 before:w-px before:bg-white/10">
      <div className="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]" aria-hidden="true" />
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#00D4FF]/80">{title}</h3>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="text-sm leading-snug text-white">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
