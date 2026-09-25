"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers, runWebsiteAnalysis } from "@/lib/onboarding/actions";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";
import { analyzeWebsiteForStep } from "@/lib/onboarding/website-step-flow";

type WebsiteStepProps = {
  answers: OnboardingAnswers;
  hasExistingContext: boolean;
  existingWebsiteUrl: string | null;
  sessionId: string;
};

export default function WebsiteStep({
  answers,
  hasExistingContext,
  existingWebsiteUrl,
}: WebsiteStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [hasWebsite, setHasWebsite] = useState<boolean | null>(
    answers.has_website ?? (existingWebsiteUrl ? true : null)
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    answers.website_url ?? existingWebsiteUrl ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  async function handleAnalyzeAndContinue() {
    setError(null);
    setAnalysisFailed(false);

    if (hasWebsite && websiteUrl.trim()) {
      const outcome = await analyzeWebsiteForStep(websiteUrl.trim(), {
        analyze: runWebsiteAnalysis,
        setAnalyzing: (value) => {
          setAnalyzing(value);
          setAnalysisStatus(value ? "Analyzing your website…" : null);
        },
      });

      // Stay on the step so the user can retry or continue manually.
      if (!outcome.ok) {
        setError(outcome.error);
        setAnalysisFailed(true);
        return;
      }
    }

    saveAndContinue();
  }

  function saveAndContinue() {
    startTransition(async () => {
      try {
        const result = await saveStepAnswers(
          {
            has_website: hasWebsite ?? false,
            website_url: hasWebsite ? websiteUrl.trim() : undefined,
          },
          "website"
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

  const urlPrefilled = existingWebsiteUrl && websiteUrl === existingWebsiteUrl;

  return (
    <div className="space-y-6">
      {hasExistingContext && existingWebsiteUrl && (
        <div className="bp-notice">
          We found your website from your Entrepreneuria profile. Architecta will analyze it to learn about your brand.
        </div>
      )}

      <div
        className="space-y-2.5"
        role="radiogroup"
        aria-label="Do you have a website?"
        aria-required="true"
      >
        <ChoiceCard
          title="I have a website"
          selected={hasWebsite === true}
          onSelect={() => setHasWebsite(true)}
          tabStop={hasWebsite !== false}
        />
        <ChoiceCard
          title="I don’t have a website yet"
          selected={hasWebsite === false}
          onSelect={() => setHasWebsite(false)}
          tabStop={hasWebsite === false}
        />
      </div>

      {hasWebsite === true && (
        <div className="space-y-2">
          <label htmlFor="onb-website-url" className="bp-label">
            Website URL
          </label>
          <input
            id="onb-website-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourdomain.com"
            aria-describedby="onb-website-url-hint"
            className="bp-field"
          />
          {urlPrefilled && (
            <p className="bp-hint text-[#7fe6ff]">
              Pre-filled from your Entrepreneuria profile
            </p>
          )}
          <p id="onb-website-url-hint" className="bp-hint">
            Architecta will analyze your homepage to extract brand and marketing context.
          </p>
        </div>
      )}

      {analysisStatus && (
        <div className="flex items-center gap-3 text-[#d3e0ec]" role="status">
          <div className="h-5 w-5 rounded-full border-2 border-slate-700 border-t-[#00d4ff] animate-spin motion-reduce:animate-none" />
          <span className="text-sm">{analysisStatus}</span>
        </div>
      )}

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      {analysisFailed && hasWebsite === true && (
        <button
          type="button"
          className="bp-btn bp-btn-secondary w-full"
          disabled={isPending || analyzing}
          onClick={saveAndContinue}
        >
          Continue without analysis
        </button>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("website")}
        isPending={isPending || analyzing}
        isValid={
          hasWebsite !== null &&
          !(hasWebsite === true && !websiteUrl.trim())
        }
        onContinue={handleAnalyzeAndContinue}
        continueLabel={hasWebsite ? "Analyze & continue" : "Continue"}
        pendingLabel={analyzing ? "Analyzing website…" : "Saving…"}
      />
    </div>
  );
}
