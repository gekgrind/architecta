"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type VisualsStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
};

const STYLE_OPTIONS = [
  { id: "minimal", label: "Minimal & clean" },
  { id: "bold", label: "Bold & high-contrast" },
  { id: "editorial", label: "Editorial & refined" },
  { id: "tech", label: "Modern SaaS / tech" },
  { id: "playful", label: "Playful & expressive" },
];

export default function VisualsStep({ answers }: VisualsStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [style, setStyle] = useState(
    answers.visual_style ?? ""
  );
  const [colors, setColors] = useState(
    (answers.primary_colors ?? []).join(", ")
  );
  const [hasLogo, setHasLogo] = useState<boolean>(
    answers.has_logo ?? false
  );

  const isValid = style.length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers(
          {
            visual_style: style,
            primary_colors: colors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
            has_logo: hasLogo,
          },
          "visuals"
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
      <div className="space-y-4">
        <p id="onb-overall-visual-style" className="bp-label">
          Overall visual style <span className="text-cyan-500" aria-hidden="true">*</span>
        </p>

        <div
          className="grid gap-2"
          role="radiogroup"
          aria-labelledby="onb-overall-visual-style"
          aria-required="true"
        >
          {STYLE_OPTIONS.map((option, i) => (
            <ChoiceCard
              key={option.id}
              compact
              title={option.label}
              selected={style === option.id}
              onSelect={() => setStyle(option.id)}
              tabStop={style === option.id || (!style && i === 0)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="onb-primary-colors" className="bp-label">
          Primary colors (optional)
        </label>
        <input
          id="onb-primary-colors"
          type="text"
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          placeholder="Indigo, charcoal, white… or #4F46E5"
          className="bp-field"
        />
        <p className="bp-hint">
          Comma-separated. Hex codes welcome.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={hasLogo}
        onClick={() => setHasLogo((v) => !v)}
        className="bp-toggle-row"
      >
        <span>I already have a logo</span>
        <span className="bp-switch" aria-hidden />
      </button>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("visuals")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
        disabledHint="Select a visual style to continue"
      />
    </div>
  );
}
