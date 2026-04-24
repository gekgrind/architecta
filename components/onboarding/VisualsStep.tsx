"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";

type VisualsStepProps = {
  initialProfile: {
    visual_style?: string | null;
    primary_colors?: string[] | null;
    has_logo?: boolean | null;
  };
  initialSession: {
    id: string;
  };
};

const STYLE_OPTIONS = [
  { id: "minimal", label: "Minimal & clean" },
  { id: "bold", label: "Bold & high-contrast" },
  { id: "editorial", label: "Editorial & refined" },
  { id: "tech", label: "Modern SaaS / tech" },
  { id: "playful", label: "Playful & expressive" },
];

export default function VisualsStep({ initialProfile }: VisualsStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [style, setStyle] = useState(
    initialProfile.visual_style ?? ""
  );
  const [colors, setColors] = useState(
    (initialProfile.primary_colors ?? []).join(", ")
  );
  const [hasLogo, setHasLogo] = useState<boolean>(
    initialProfile.has_logo ?? false
  );

  const isValid = style.length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      await updateArchitectaOnboarding({
        visual_style: style,
        primary_colors: colors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        has_logo: hasLogo,
      });

      await setArchitectaOnboardingStep("visuals");

      router.push("/onboarding/review");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Visual identity
        </h1>
        <p className="text-slate-400 text-lg">
          This helps Architecta format content to match your brand.
        </p>
      </div>

      {/* Style selection */}
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

      {/* Color preferences */}
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

      {/* Logo toggle */}
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

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        disabled={!isValid || isPending}
        onClick={handleContinue}
      >
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
