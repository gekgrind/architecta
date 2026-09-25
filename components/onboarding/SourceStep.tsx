"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";

type SourceOption =
  | "new"
  | "existing"
  | "rebrand"
  | "creator"
  | "agency";

const OPTIONS: {
  id: SourceOption;
  title: string;
  description: string;
}[] = [
  {
    id: "new",
    title: "Brand new idea",
    description: "Starting from scratch with a new business or concept.",
  },
  {
    id: "existing",
    title: "Existing business",
    description: "You already have something live and want better structure.",
  },
  {
    id: "rebrand",
    title: "Rebrand or pivot",
    description: "Same foundation, new direction or positioning.",
  },
  {
    id: "creator",
    title: "Personal brand / creator",
    description: "Content-first brand built around you.",
  },
  {
    id: "agency",
    title: "Agency or client work",
    description: "You create content systems for others.",
  },
];

export default function SourceStep() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SourceOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!selected) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers({ source_type: selected }, "source");

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
    <div className="space-y-6">
      <div className="space-y-3" role="radiogroup" aria-label="Where are you starting from?" aria-required="true">
        {OPTIONS.map((option) => {
          const isActive = selected === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setSelected(option.id)}
              className={`w-full rounded-xl border p-4 text-left transition
                ${
                  isActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                }`}
            >
              <div className="font-medium text-white">
                {option.title}
              </div>
              <div className="text-sm text-slate-400">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <StepNavigation
        backUrl={getPreviousStepUrl("source")}
        isPending={isPending}
        isValid={!!selected}
        onContinue={handleContinue}
        disabledHint="Select an option to continue"
      />
    </div>
  );
}
