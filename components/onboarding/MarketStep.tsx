"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";

type MarketStepProps = {
  initialProfile: {
    primary_market?: string | null;
    niche?: string | null;
    competitors?: string[] | null;
  };
  initialSession: {
    id: string;
  };
};

export default function MarketStep({ initialProfile }: MarketStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [primaryMarket, setPrimaryMarket] = useState(
    initialProfile.primary_market ?? ""
  );
  const [niche, setNiche] = useState(
    initialProfile.niche ?? ""
  );
  const [competitors, setCompetitors] = useState(
    (initialProfile.competitors ?? []).join(", ")
  );

  const isValid =
    primaryMarket.trim().length > 0 &&
    niche.trim().length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      await updateArchitectaOnboarding({
        primary_market: primaryMarket.trim(),
        niche: niche.trim(),
        competitors: competitors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });

      await setArchitectaOnboardingStep("market");

      router.push("/onboarding/customers");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Market & positioning
        </h1>
        <p className="text-slate-400 text-lg">
          This helps Architecta avoid generic content.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Primary market */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Primary market
          </label>
          <input
            type="text"
            value={primaryMarket}
            onChange={(e) => setPrimaryMarket(e.target.value)}
            placeholder="B2B SaaS, wellness, ecommerce, creators, etc."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Niche */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Niche or focus area
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Early-stage founders, solo consultants, local services…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Competitors */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Competitors (optional)
          </label>
          <input
            type="text"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="Competitor A, Competitor B, Competitor C"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <p className="text-sm text-slate-500">
            Comma-separated. This helps Architecta sharpen differentiation.
          </p>
        </div>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        disabled={!isValid || isPending}
        onClick={handleContinue}
      >
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
