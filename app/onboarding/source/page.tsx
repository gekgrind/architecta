"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setArchitectaOnboardingStep } from "@/lib/onboarding/actions";
import { updateArchitectaOnboarding } from "@/lib/onboarding/actions";

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

export default function SourcePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SourceOption | null>(null);

  function handleContinue() {
    if (!selected) return;

    startTransition(async () => {
      // Save answer
      await updateArchitectaOnboarding({
        source_type: selected,
      });

      // Advance step
      await setArchitectaOnboardingStep("source");

      router.push("/onboarding/website");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Where are you starting from?
        </h1>
        <p className="text-slate-400 text-lg">
          This helps Architecta design the right system for you.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {OPTIONS.map((option) => {
          const isActive = selected === option.id;

          return (
            <button
              key={option.id}
              type="button"
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

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        disabled={!selected || isPending}
        onClick={handleContinue}
      >
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
