"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";

type FoundationStepProps = {
  initialProfile: {
    brand_values?: string[] | null;
    brand_personality?: {
      boldness?: number;
      tone?: number;
      authority?: number;
    } | null;
  };
  initialSession: {
    id: string;
  };
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

export default function FoundationStep({ initialProfile }: FoundationStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<string[]>(
    initialProfile.brand_values ?? []
  );

  const [boldness, setBoldness] = useState(
    initialProfile.brand_personality?.boldness ?? 50
  );
  const [tone, setTone] = useState(
    initialProfile.brand_personality?.tone ?? 50
  );
  const [authority, setAuthority] = useState(
    initialProfile.brand_personality?.authority ?? 50
  );

  const isValid = values.length > 0;

  function toggleValue(value: string) {
    setValues((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].slice(0, 5) // max 5 values
    );
  }

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      await updateArchitectaOnboarding({
        brand_values: values,
        brand_personality: {
          boldness,
          tone,
          authority,
        },
      });

      await setArchitectaOnboardingStep("foundation");

      router.push("/onboarding/voice");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Brand foundation
        </h1>
        <p className="text-slate-400 text-lg">
          These guide every message Architecta creates.
        </p>
      </div>

      {/* Values */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Core values (choose up to 5)
        </label>

        <div className="grid grid-cols-2 gap-2">
          {VALUE_OPTIONS.map((value) => {
            const active = values.includes(value);

            return (
              <button
                key={value}
                type="button"
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

      {/* Personality sliders */}
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
