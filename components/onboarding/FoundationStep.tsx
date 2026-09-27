"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";
import { matchWebsiteValuesToOptions } from "@/lib/onboarding/website-step-flow";

type FoundationStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
};

const VALUE_OPTIONS = [
  "Clarity",
  "Integrity",
  "Innovation",
  "Trust",
  "Empathy",
  "Boldness",
  "Simplicity",
  "Excellence",
];

export default function FoundationStep({ answers }: FoundationStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wa = answers.website_analysis;
  const suggestedValues = matchWebsiteValuesToOptions(wa?.values, VALUE_OPTIONS);

  const [values, setValues] = useState<string[]>(
    answers.brand_values ?? suggestedValues
  );

  const [boldness, setBoldness] = useState(
    answers.brand_personality?.boldness ?? 50
  );
  const [tone, setTone] = useState(
    answers.brand_personality?.tone ?? 50
  );
  const [authority, setAuthority] = useState(
    answers.brand_personality?.authority ?? 50
  );

  const isValid = values.length > 0;

  function toggleValue(value: string) {
    setValues((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].slice(0, 5)
    );
  }

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers(
          {
            brand_values: values,
            brand_personality: {
              boldness,
              tone,
              authority,
            },
          },
          "foundation"
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
    <div className="space-y-8">
      {suggestedValues.length > 0 && !answers.brand_values && (
        <div className="bp-notice">
          <p>
            Pre-selected based on your website: <strong>{suggestedValues.join(", ")}</strong>. Adjust as needed.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <p id="onb-core-values" className="bp-label">
          Core values (choose up to 5) <span className="text-cyan-500" aria-hidden="true">*</span>
        </p>

        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-labelledby="onb-core-values"
        >
          {VALUE_OPTIONS.map((value) => (
            <ChoiceCard
              key={value}
              mode="multi"
              compact
              title={value}
              selected={values.includes(value)}
              onSelect={() => toggleValue(value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="onb-boldness" className="bp-label mb-1">
            Boldness
          </label>
          <input
            id="onb-boldness"
            type="range"
            min={0}
            max={100}
            value={boldness}
            onChange={(e) => setBoldness(Number(e.target.value))}
            className="bp-range"
          />
          <div className="bp-hint flex justify-between">
            <span>Reserved</span>
            <span>Bold</span>
          </div>
        </div>

        <div>
          <label htmlFor="onb-tone" className="bp-label mb-1">
            Tone
          </label>
          <input
            id="onb-tone"
            type="range"
            min={0}
            max={100}
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
            className="bp-range"
          />
          <div className="bp-hint flex justify-between">
            <span>Friendly</span>
            <span>Direct</span>
          </div>
        </div>

        <div>
          <label htmlFor="onb-authority" className="bp-label mb-1">
            Authority
          </label>
          <input
            id="onb-authority"
            type="range"
            min={0}
            max={100}
            value={authority}
            onChange={(e) => setAuthority(Number(e.target.value))}
            className="bp-range"
          />
          <div className="bp-hint flex justify-between">
            <span>Approachable</span>
            <span>Authoritative</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("foundation")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
        disabledHint="Select at least one core value to continue"
      />
    </div>
  );
}
