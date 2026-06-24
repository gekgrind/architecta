"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

type ProviderUsage = {
  provider: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
};

type UsageResponse = {
  windowDays: number;
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    fallbackCalls: number;
  };
  byProvider: ProviderUsage[];
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
};

export function AiUsageCard() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/usage?days=30", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse<UsageResponse> | null;
        if (cancelled) return;
        if (!json?.ok) {
          setError(json?.ok === false ? json.error.message : "Could not load usage");
        } else {
          setUsage(json.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load usage");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardCard title="AI Usage" icon={Cpu}>
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : error ? (
        <p className="text-sm text-[#BCC0D8]">{error}</p>
      ) : usage ? (
        <div className="space-y-5">
          <p className="text-[10px] uppercase tracking-widest text-[#BCC0D8]">
            Last {usage.windowDays} days
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight text-white">
                {usage.totals.calls}
              </p>
              <p className="text-[10px] uppercase text-[#BCC0D8]">Generations</p>
            </div>
            <div>
              <p className="font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight text-white">
                {formatTokens(usage.totals.totalTokens)}
              </p>
              <p className="text-[10px] uppercase text-[#BCC0D8]">Tokens</p>
            </div>
            <div>
              <p className="font-[var(--font-science-gothic,var(--font-inter))] text-2xl font-bold italic tracking-tight text-[#FFE14D]">
                {formatCost(usage.totals.costUsd)}
              </p>
              <p className="text-[10px] uppercase text-[#BCC0D8]">Est. cost</p>
            </div>
          </div>

          {usage.byProvider.length > 0 ? (
            <div className="space-y-2">
              {usage.byProvider.map((p) => {
                const pct =
                  usage.totals.totalTokens > 0
                    ? Math.round((p.totalTokens / usage.totals.totalTokens) * 100)
                    : 0;
                return (
                  <div key={p.provider} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white">
                        {PROVIDER_LABEL[p.provider] ?? p.provider}
                      </span>
                      <span className="text-[#BCC0D8]">
                        {p.calls} calls · {formatTokens(p.totalTokens)} tok
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-[#00D4FF]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-[#BCC0D8]">
              <Activity size={14} className="text-[#00D4FF]" />
              No AI calls recorded yet. Generate content to start tracking.
            </div>
          )}

          {usage.totals.fallbackCalls > 0 ? (
            <p className="text-[10px] text-[#BCC0D8]">
              {usage.totals.fallbackCalls} call
              {usage.totals.fallbackCalls === 1 ? "" : "s"} used a provider fallback.
            </p>
          ) : null}
        </div>
      ) : null}
    </DashboardCard>
  );
}
