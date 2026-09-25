"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
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
    <div className="space-y-8">
      {wa?.tone && !answers.voice_tone && (
        <div className="bp-notice">
          <p>
            Based on your website, your tone appears to be: <strong>{wa.tone}</strong>
            {wa.voice_characteristics ? ` — ${wa.voice_characteristics}` : ""}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <p id="onb-overall-tone" className="bp-label">
          Overall tone
        </p>

        <div
          className="grid gap-2"
          role="group"
          aria-labelledby="onb-overall-tone"
        >
          {TONE_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.id}
              compact
              title={option.label}
              selected={tone === option.id}
              onSelect={() => setTone(option.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="onb-words-to-use" className="bp-label">
            Words or phrases to use (optional)
          </label>
          <input
            id="onb-words-to-use"
            type="text"
            value={wordsToUse}
            onChange={(e) => setWordsToUse(e.target.value)}
            placeholder="clear, simple, actionable…"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-words-to-avoid" className="bp-label">
            Words or phrases to avoid (optional)
          </label>
          <input
            id="onb-words-to-avoid"
            type="text"
            value={wordsToAvoid}
            onChange={(e) => setWordsToAvoid(e.target.value)}
            placeholder="hustle, guru, hack…"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-reference-brands" className="bp-label">
            Brands you admire (optional)
          </label>
          <input
            id="onb-reference-brands"
            type="text"
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="Apple, Notion, Patagonia…"
            className="bp-field"
          />
          <p className="bp-hint">
            Used for tone reference, not imitation.
          </p>
        </div>
      </div>

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("voice")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
      />
    </div>
  );
}
