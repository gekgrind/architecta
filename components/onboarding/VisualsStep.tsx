"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
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
    });
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Visual identity
        </h1>
        <p className="text-slate-400 text-lg">
          This helps Architecta format content to match your brand.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Overall visual style
        </label>

        <div className="grid gap-2">
          {STYLE_OPTIONS.map((option) => {
            const active = style === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setStyle(option.id)}
                className={`rounded-lg border px-4 py-3 text-left transition
                  ${
                    active
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
              >
                <span className="text-sm text-white">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Primary colors (optional)
        </label>
        <input
          type="text"
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          placeholder="Indigo, charcoal, white… or #4F46E5"
          className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <p className="text-sm text-slate-500">
          Comma-separated. Hex codes welcome.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
        <span className="text-sm text-slate-300">
          I already have a logo
        </span>
        <button
          type="button"
          onClick={() => setHasLogo((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition
            ${hasLogo ? "bg-indigo-500" : "bg-slate-700"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition
              ${hasLogo ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <StepNavigation
        backUrl={getPreviousStepUrl("visuals")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
      />
    </div>
  );
}
