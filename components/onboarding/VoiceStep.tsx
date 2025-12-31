"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";

type VoiceStepProps = {
  initialProfile: {
    voice_tone?: string | null;
    words_to_use?: string[] | null;
    words_to_avoid?: string[] | null;
    reference_brands?: string[] | null;
  };
  initialSession: {
    id: string;
  };
};

const TONE_OPTIONS = [
  { id: "calm", label: "Calm & thoughtful" },
  { id: "bold", label: "Bold & confident" },
  { id: "friendly", label: "Friendly & conversational" },
  { id: "direct", label: "Direct & no-fluff" },
  { id: "inspiring", label: "Inspiring & aspirational" },
];

export default function VoiceStep({ initialProfile }: VoiceStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tone, setTone] = useState(
    initialProfile.voice_tone ?? ""
  );

  const [wordsToUse, setWordsToUse] = useState(
    (initialProfile.words_to_use ?? []).join(", ")
  );

  const [wordsToAvoid, setWordsToAvoid] = useState(
    (initialProfile.words_to_avoid ?? []).join(", ")
  );

  const [references, setReferences] = useState(
    (initialProfile.reference_brands ?? []).join(", ")
  );

  const isValid = tone.length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      await updateArchitectaOnboarding({
        voice_tone: tone,
        words_to_use: wordsToUse
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean),
        words_to_avoid: wordsToAvoid
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean),
        reference_brands: references
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
      });

      await setArchitectaOnboardingStep("voice");

      router.push("/onboarding/visuals");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Voice & messaging
        </h1>
        <p className="text-slate-400 text-lg">
          This defines how Architecta speaks on your behalf.
        </p>
      </div>

      {/* Tone selection */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Overall tone
        </label>

        <div className="grid gap-2">
          {TONE_OPTIONS.map((option) => {
            const active = tone === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTone(option.id)}
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

      {/* Language preferences */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Words or phrases to use (optional)
          </label>
          <input
            type="text"
            value={wordsToUse}
            onChange={(e) => setWordsToUse(e.target.value)}
            placeholder="clear, simple, actionable…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Words or phrases to avoid (optional)
          </label>
          <input
            type="text"
            value={wordsToAvoid}
            onChange={(e) => setWordsToAvoid(e.target.value)}
            placeholder="hustle, guru, hack…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Brands you admire (optional)
          </label>
          <input
            type="text"
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="Apple, Notion, Patagonia…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <p className="text-sm text-slate-500">
            Used for tone reference, not imitation.
          </p>
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
