"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type CustomersStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
};

const PAIN_OPTIONS = [
  "Lack of clarity",
  "Inconsistent content",
  "Low engagement",
  "No time to create content",
  "Unclear positioning",
  "Not converting attention into customers",
];

export default function CustomersStep({ answers }: CustomersStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wa = answers.website_analysis;

  const [role, setRole] = useState(
    answers.customer_role ?? wa?.typical_customers ?? wa?.audience ?? ""
  );
  const [pains, setPains] = useState<string[]>(
    answers.customer_pains ?? []
  );
  const [outcome, setOutcome] = useState(
    answers.customer_outcome ?? ""
  );

  const isValid =
    role.trim().length > 0 &&
    pains.length > 0 &&
    outcome.trim().length > 0;

  function togglePain(pain: string) {
    setPains((prev) =>
      prev.includes(pain)
        ? prev.filter((p) => p !== pain)
        : [...prev, pain]
    );
  }

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers(
          {
            customer_role: role.trim(),
            customer_pains: pains,
            customer_outcome: outcome.trim(),
          },
          "customers"
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
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="onb-customer-role" className="bp-label">
            Your ideal customer <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            id="onb-customer-role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Solo founders, busy professionals, local business owners…"
            aria-required="true"
            className="bp-field"
          />
        </div>

        <div className="space-y-3">
          <p id="onb-customer-pains" className="bp-label">
            What are they struggling with? <span className="text-cyan-500" aria-hidden="true">*</span>
          </p>

          <div
            className="grid gap-2"
            role="group"
            aria-labelledby="onb-customer-pains"
          >
            {PAIN_OPTIONS.map((pain) => (
              <ChoiceCard
                key={pain}
                mode="multi"
                compact
                title={pain}
                selected={pains.includes(pain)}
                onSelect={() => togglePain(pain)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-customer-outcome" className="bp-label">
            What outcome do they want? <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="onb-customer-outcome"
            rows={3}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What does success look like for them?"
            aria-required="true"
            className="bp-field"
          />
        </div>
      </div>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("customers")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
        disabledHint="Complete all required fields to continue"
      />
    </div>
  );
}
