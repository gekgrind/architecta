"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import AISuggestions from "@/components/onboarding/AISuggestions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type SnapshotStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
  hasExistingContext: boolean;
};

export default function SnapshotStep({
  answers,
  hasExistingContext,
}: SnapshotStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wa = answers.website_analysis;

  const [brandName, setBrandName] = useState(
    answers.brand_name ?? wa?.brand_name ?? ""
  );
  const [industry, setIndustry] = useState(
    answers.industry ?? wa?.industry ?? ""
  );
  const [description, setDescription] = useState(
    answers.description ?? wa?.description ?? ""
  );

  const prefilled = hasExistingContext || !!wa;

  const isValid =
    brandName.trim().length > 0 &&
    industry.trim().length > 0 &&
    description.trim().length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      const result = await saveStepAnswers(
        {
          brand_name: brandName.trim(),
          industry: industry.trim(),
          description: description.trim(),
        },
        "snapshot"
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
      {prefilled && (
        <div className="bp-notice">
          <p>
            {wa
              ? "Pre-filled from your website analysis. Review and adjust anything that doesn't look right."
              : "Pre-filled from your Entrepreneuria profile. Review and adjust as needed."}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="onb-brand-name" className="bp-label">
            Brand or business name
          </label>
          <input
            id="onb-brand-name"
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Studio"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-industry" className="bp-label">
            Industry
          </label>
          <input
            id="onb-industry"
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="SaaS, wellness, ecommerce, creator, etc."
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-description" className="bp-label">
            What do you do?
          </label>
          <textarea
            id="onb-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Explain it like you would to a smart friend."
            className="bp-field"
          />
        </div>
      </div>

      <AISuggestions
        step="snapshot"
        context={{
          brand_name: brandName,
          industry,
        }}
        onApply={(text) => setDescription(text)}
      />

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("snapshot")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
      />
    </div>
  );
}
