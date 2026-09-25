"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

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

  const [values, setValues] = useState<string[]>(
    answers.brand_values ?? []
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
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Brand foundation
        </h1>
        <p className="text-slate-400 text-lg">
          These guide every message Architecta creates.
        </p>
      </div>

      <div className="space-y-4">
        <label id="values-label" className="block text-sm font-medium text-slate-300">
          Core values (choose up to 5) <span className="text-cyan-500" aria-hidden="true">*</span>
        </label>

        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="values-label">
          {VALUE_OPTIONS.map((value) => {
            const active = values.includes(value);

            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleValue(value)}
                className={`rounded-lg border px-4 py-2 text-left transition
                  ${
                    active
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
              >
                <span className="text-sm text-white">{value}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Boldness
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={boldness}
            onChange={(e) => setBoldness(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Reserved</span>
            <span>Bold</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Tone
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Friendly</span>
            <span>Direct</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Authority
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={authority}
            onChange={(e) => setAuthority(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Approachable</span>
            <span>Authoritative</span>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

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
