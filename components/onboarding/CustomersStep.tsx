"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
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
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Who are you creating for?
        </h1>
        <p className="text-slate-400 text-lg">
          Clear customer insight makes content convert.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Your ideal customer <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Solo founders, busy professionals, local business owners…"
            aria-required="true"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-3">
          <label id="pains-label" className="block text-sm font-medium text-slate-300">
            What are they struggling with? <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>

          <div className="grid gap-2" role="group" aria-labelledby="pains-label">
            {PAIN_OPTIONS.map((pain) => {
              const active = pains.includes(pain);

              return (
                <button
                  key={pain}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePain(pain)}
                  className={`rounded-lg border px-4 py-2 text-left transition
                    ${
                      active
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                  <span className="text-sm text-white">{pain}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            What outcome do they want? <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <textarea
            rows={3}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What does success look like for them?"
            aria-required="true"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

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
