"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type MarketStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
};

export default function MarketStep({ answers }: MarketStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [primaryMarket, setPrimaryMarket] = useState(
    answers.primary_market ?? ""
  );
  const [niche, setNiche] = useState(
    answers.niche ?? ""
  );
  const [competitors, setCompetitors] = useState(
    (answers.competitors ?? []).join(", ")
  );

  const isValid =
    primaryMarket.trim().length > 0 &&
    niche.trim().length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers(
          {
            primary_market: primaryMarket.trim(),
            niche: niche.trim(),
            competitors: competitors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          },
          "market"
        );

        if (!result.ok) {
          setError(result.error);
          return;
        }

        router.push(result.next);
      } catch {
        setError("Something went wrong saving your answers. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Market & positioning
        </h1>
        <p className="text-slate-400 text-lg">
          This helps Architecta avoid generic content.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Primary market <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            value={primaryMarket}
            onChange={(e) => setPrimaryMarket(e.target.value)}
            placeholder="B2B SaaS, wellness, ecommerce, creators, etc."
            aria-required="true"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Niche or focus area <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Early-stage founders, solo consultants, local services…"
            aria-required="true"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

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

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <StepNavigation
        backUrl={getPreviousStepUrl("market")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
        disabledHint="Fill in primary market and niche to continue"
      />
    </div>
  );
}
