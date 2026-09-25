"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers, runWebsiteAnalysis } from "@/lib/onboarding/actions";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import StepNavigation from "@/components/onboarding/StepNavigation";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

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

  async function handleAnalyzeAndContinue() {
    setError(null);

    if (hasWebsite && websiteUrl.trim()) {
      setAnalyzing(true);
      setAnalysisStatus("Analyzing your website…");

      const analysisResult = await runWebsiteAnalysis(websiteUrl.trim());

      setAnalyzing(false);
      setAnalysisStatus(null);

      if (!analysisResult.ok) {
        setError(`Website analysis failed: ${analysisResult.error}. You can continue manually.`);
      }
    }

    startTransition(async () => {
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

      <div className="space-y-2.5">
        <ChoiceCard
          title="I have a website"
          selected={hasWebsite === true}
          onSelect={() => setHasWebsite(true)}
        />
        <ChoiceCard
          title="I don’t have a website yet"
          selected={hasWebsite === false}
          onSelect={() => setHasWebsite(false)}
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
