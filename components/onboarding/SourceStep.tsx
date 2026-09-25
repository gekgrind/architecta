"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
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
      const result = await saveStepAnswers({ source_type: selected }, "source");

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(result.next);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        {OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            title={option.title}
            description={option.description}
            selected={selected === option.id}
            onSelect={() => setSelected(option.id)}
          />
        ))}
      </div>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("source")}
        isPending={isPending}
        isValid={!!selected}
        onContinue={handleContinue}
      />
    </div>
  );
}
