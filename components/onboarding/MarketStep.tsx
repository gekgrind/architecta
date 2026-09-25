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
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="onb-primary-market" className="bp-label">
            Primary market
          </label>
          <input
            id="onb-primary-market"
            type="text"
            value={primaryMarket}
            onChange={(e) => setPrimaryMarket(e.target.value)}
            placeholder="B2B SaaS, wellness, ecommerce, creators, etc."
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-niche" className="bp-label">
            Niche or focus area
          </label>
          <input
            id="onb-niche"
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Early-stage founders, solo consultants, local services…"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-competitors" className="bp-label">
            Competitors (optional)
          </label>
          <input
            id="onb-competitors"
            type="text"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="Competitor A, Competitor B, Competitor C"
            className="bp-field"
          />
          <p className="bp-hint">
            Comma-separated. This helps Architecta sharpen differentiation.
          </p>
        </div>
      </div>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("market")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
      />
    </div>
  );
}
