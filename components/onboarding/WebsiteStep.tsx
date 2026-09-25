"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveStepAnswers, runWebsiteAnalysis } from "@/lib/onboarding/actions";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
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
  const pathname = usePathname();
  const isPreview = pathname === "/onboarding/preview";
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
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Connect your website
        </h1>
        <p className="text-slate-400 text-lg">
          If you connect your site, Architecta can auto-build most of your Brand Kit.
        </p>
      </div>

      {hasExistingContext && existingWebsiteUrl && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
          <p className="text-sm text-indigo-300">
            We found your website from your Entrepreneuria profile. Architecta will analyze it to learn about your brand.
          </p>
        </div>
      )}

      <div className="space-y-3" role="radiogroup" aria-label="Do you have a website?" aria-required="true">
        <button
          role="radio"
          aria-checked={hasWebsite === true}
          className={`w-full rounded-xl border p-4 text-left transition ${
            hasWebsite === true ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
          }`}
          onClick={() => setHasWebsite(true)}
        >
          <span className="font-medium text-white">I have a website</span>
        </button>
        <button
          role="radio"
          aria-checked={hasWebsite === false}
          className={`w-full rounded-xl border p-4 text-left transition ${
            hasWebsite === false ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
          }`}
          onClick={() => setHasWebsite(false)}
        >
          <span className="font-medium text-white">I don&apos;t have a website yet</span>
        </button>
      </div>

      {hasWebsite === true && (
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Website URL</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourdomain.com"
            className="w-full rounded-xl bg-slate-900 border border-slate-800 p-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {urlPrefilled && (
            <p className="text-xs text-indigo-400">
              Pre-filled from your Entrepreneuria profile
            </p>
          )}
          <p className="text-xs text-slate-500">
            Architecta will analyze your homepage to extract brand and marketing context.
          </p>
        </div>
      )}

      {analysisStatus && (
        <div className="flex items-center gap-3 text-slate-300">
          <div className="h-5 w-5 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
          <span className="text-sm">{analysisStatus}</span>
        </div>
      )}

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      {analysisFailed && hasWebsite === true && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isPending || analyzing}
          onClick={saveAndContinue}
        >
          Continue without analysis
        </Button>
      )}

      <div className="flex gap-3">
        {getPreviousStepUrl("website") && (
          <Button
            variant="outline"
            size="lg"
            className="flex-shrink-0"
            disabled={isPending || analyzing}
            onClick={() => {
              const back = getPreviousStepUrl("website")!;
              router.push(isPreview ? `/onboarding/preview?step=${back.replace("/onboarding/", "")}` : back);
            }}
          >
            Back
          </Button>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={
            isPending ||
            analyzing ||
            hasWebsite === null ||
            (hasWebsite === true && !websiteUrl.trim())
          }
          onClick={handleAnalyzeAndContinue}
        >
          {analyzing
            ? "Analyzing website…"
            : isPending
            ? "Saving…"
            : hasWebsite
            ? "Analyze & continue"
            : "Continue"}
        </Button>
      </div>
    </div>
  );
}
