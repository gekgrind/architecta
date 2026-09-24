"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveStepAnswers, runWebsiteAnalysis } from "@/lib/onboarding/actions";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
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

      <div className="space-y-3">
        <button
          className={`w-full rounded-xl border p-4 text-left transition ${
            hasWebsite === true ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
          }`}
          onClick={() => setHasWebsite(true)}
        >
          <span className="font-medium text-white">I have a website</span>
        </button>
        <button
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        {getPreviousStepUrl("website") && (
          <Button
            variant="outline"
            size="lg"
            className="flex-shrink-0"
            disabled={isPending || analyzing}
            onClick={() => router.push(getPreviousStepUrl("website")!)}
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
