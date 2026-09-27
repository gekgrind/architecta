"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getWebsiteAnalysisStatus, saveStepAnswers } from "@/lib/onboarding/actions";
import AISuggestions from "@/components/onboarding/AISuggestions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";
import {
  fillUntouchedEmptyFields,
  initialStepValue,
  isWebsiteAnalysisPending,
  snapshotWebsiteSuggestions,
  WEBSITE_ANALYSIS_POLL_INTERVAL_MS,
  WEBSITE_ANALYSIS_POLL_MAX_MS,
  type SnapshotFields,
  type WebsiteAnalysisStatus,
} from "@/lib/onboarding/website-step-flow";

type SnapshotStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
  hasExistingContext: boolean;
  websiteAnalysisStatus?: WebsiteAnalysisStatus | null;
};

export default function SnapshotStep({
  answers,
  hasExistingContext,
  websiteAnalysisStatus = null,
}: SnapshotStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A "low" confidence analysis is context, not an answer — don't silently
  // populate a required field from a guess the site barely supports.
  const initial = snapshotWebsiteSuggestions(answers.website_analysis);

  const [brandName, setBrandName] = useState(
    initialStepValue(answers.brand_name, initial.brandName, "")
  );
  const [industry, setIndustry] = useState(
    initialStepValue(answers.industry, initial.industry, "")
  );
  const [description, setDescription] = useState(
    initialStepValue(answers.description, initial.description, "")
  );

  const [websitePrefilled, setWebsitePrefilled] = useState(
    !!(initial.brandName || initial.industry || initial.description)
  );
  const [analysisPending, setAnalysisPending] = useState(
    !answers.website_analysis && isWebsiteAnalysisPending(websiteAnalysisStatus)
  );
  const prefilled = hasExistingContext || websitePrefilled;

  // The background analysis usually finishes after this step renders. Poll
  // briefly and fill ONLY fields the user hasn't touched and left empty.
  const touched = useRef<Record<keyof SnapshotFields, boolean>>({
    brandName: false,
    industry: false,
    description: false,
  });
  const current = useRef<SnapshotFields>({ brandName, industry, description });
  useEffect(() => {
    current.current = { brandName, industry, description };
  }, [brandName, industry, description]);

  useEffect(() => {
    if (!analysisPending) return;

    let stopped = false;
    const startedAt = Date.now();
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      setAnalysisPending(false);
    };

    const timer = setInterval(async () => {
      if (stopped) return;
      if (Date.now() - startedAt > WEBSITE_ANALYSIS_POLL_MAX_MS) return stop();

      const { status, analysis } = await getWebsiteAnalysisStatus().catch(() => ({
        status: null,
        analysis: null,
      }));
      if (stopped || isWebsiteAnalysisPending(status)) return;

      stop();
      if (status !== "completed" || !analysis) return;

      const next = fillUntouchedEmptyFields(
        current.current,
        touched.current,
        snapshotWebsiteSuggestions(analysis)
      );
      if (next.brandName !== current.current.brandName) setBrandName(next.brandName);
      if (next.industry !== current.current.industry) setIndustry(next.industry);
      if (next.description !== current.current.description) setDescription(next.description);
      if (
        next.brandName !== current.current.brandName ||
        next.industry !== current.current.industry ||
        next.description !== current.current.description
      ) {
        setWebsitePrefilled(true);
      }
    }, WEBSITE_ANALYSIS_POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [analysisPending]);

  const isValid =
    brandName.trim().length > 0 &&
    industry.trim().length > 0 &&
    description.trim().length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers(
          {
            brand_name: brandName.trim(),
            industry: industry.trim(),
            description: description.trim(),
          },
          "snapshot"
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

  return (
    <div className="space-y-8">
      {analysisPending && !websitePrefilled ? (
        <div className="bp-notice">
          <p>Analyzing your website… we&apos;ll fill in anything you haven&apos;t yet.</p>
        </div>
      ) : prefilled && (
        <div className="bp-notice">
          <p>
            {websitePrefilled
              ? "Pre-filled from your website analysis. Review and adjust anything that doesn't look right."
              : "Pre-filled from your Entrepreneuria profile. Review and adjust as needed."}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="onb-brand-name" className="bp-label">
            Brand or business name <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            id="onb-brand-name"
            type="text"
            value={brandName}
            onChange={(e) => {
              touched.current.brandName = true;
              setBrandName(e.target.value);
            }}
            placeholder="Acme Studio"
            aria-required="true"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-industry" className="bp-label">
            Industry <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <input
            id="onb-industry"
            type="text"
            value={industry}
            onChange={(e) => {
              touched.current.industry = true;
              setIndustry(e.target.value);
            }}
            placeholder="SaaS, wellness, ecommerce, creator, etc."
            aria-required="true"
            className="bp-field"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="onb-description" className="bp-label">
            What do you do? <span className="text-cyan-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="onb-description"
            value={description}
            onChange={(e) => {
              touched.current.description = true;
              setDescription(e.target.value);
            }}
            rows={4}
            placeholder="Explain it like you would to a smart friend."
            aria-required="true"
            className="bp-field"
          />
        </div>
      </div>

      <AISuggestions
        step="snapshot"
        context={{
          brand_name: brandName,
          industry,
        }}
        onApply={(text) => {
          touched.current.description = true;
          setDescription(text);
        }}
      />

      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}

      <StepNavigation
        backUrl={getPreviousStepUrl("snapshot")}
        isPending={isPending}
        isValid={isValid}
        onContinue={handleContinue}
        disabledHint="Fill in all required fields to continue"
      />
    </div>
  );
}
