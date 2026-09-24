"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type VoiceStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
};

const TONE_OPTIONS = [
  { id: "calm", label: "Calm & thoughtful" },
  { id: "bold", label: "Bold & confident" },
  { id: "friendly", label: "Friendly & conversational" },
  { id: "direct", label: "Direct & no-fluff" },
  { id: "inspiring", label: "Inspiring & aspirational" },
];

export default function VoiceStep({ answers }: VoiceStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wa = answers.website_analysis;

  const [tone, setTone] = useState(
    answers.voice_tone ?? ""
  );

  const [wordsToUse, setWordsToUse] = useState(
    (answers.words_to_use ?? []).join(", ")
  );

  const [wordsToAvoid, setWordsToAvoid] = useState(
    (answers.words_to_avoid ?? []).join(", ")
  );

  const [references, setReferences] = useState(
    (answers.reference_brands ?? []).join(", ")
  );

  const isValid = tone.length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      const result = await saveStepAnswers(
        {
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
        },
        "voice"
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
          Voice & messaging
        </h1>
        <p className="text-slate-400 text-lg">
          This defines how Architecta speaks on your behalf.
        </p>
      </div>

      {wa?.tone && !answers.voice_tone && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
          <p className="text-sm text-indigo-300">
            Based on your website, your tone appears to be: <strong>{wa.tone}</strong>
            {wa.voice_characteristics ? ` — ${wa.voice_characteristics}` : ""}
          </p>
        </div>
      )}

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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <StepNavigation
        backUrl={getPreviousStepUrl("voice")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
      />
    </div>
  );
}
