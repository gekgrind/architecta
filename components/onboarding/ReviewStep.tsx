"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAnswers } from "@/lib/onboarding/actions";
import StepNavigation from "@/components/onboarding/StepNavigation";
import { getPreviousStepUrl } from "@/lib/onboarding/steps";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

type ReviewStepProps = {
  answers: OnboardingAnswers;
  sessionId: string;
  hasExistingContext: boolean;
};

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value?: string | string[] | null;
}) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  return (
    <div className="space-y-1">
      <div className="bp-hint text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm text-[#eef4fa] break-words">
        {Array.isArray(value) ? value.join(", ") : value}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4ff]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function ReviewStep({
  answers,
  hasExistingContext,
}: ReviewStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await saveStepAnswers({}, "review");

        if (!result.ok) {
          setError(result.error);
          return;
        }

        router.push(result.next);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const hasData = !!(
    answers.brand_name ||
    answers.industry ||
    answers.description ||
    answers.customer_role
  );

  return (
    <div className="space-y-8">
      {hasExistingContext && (
        <div className="bp-notice">
          <p>
            Some of this was pre-filled from your Entrepreneuria profile
            {answers.website_analysis ? " and website analysis" : ""}.
            You can go back to any step to make changes.
          </p>
        </div>
      )}

      {!hasData && (
        <div className="bp-notice bp-notice-warn">
          <p>
            It looks like some information might be missing. You can go back to fill in more details, or continue to generate with what you have.
          </p>
        </div>
      )}

      <div className="bp-panel space-y-8 p-5 sm:p-6">
        <ReviewSection title="Business">
          <ReviewItem label="Brand name" value={answers.brand_name} />
          <ReviewItem label="Industry" value={answers.industry} />
          <ReviewItem label="Description" value={answers.description} />
          <ReviewItem label="Website" value={answers.website_url} />
        </ReviewSection>

        <ReviewSection title="Audience">
          <ReviewItem label="Primary market" value={answers.primary_market} />
          <ReviewItem label="Niche" value={answers.niche} />
          <ReviewItem label="Ideal customer" value={answers.customer_role} />
          <ReviewItem label="Pain points" value={answers.customer_pains} />
          <ReviewItem label="Desired outcome" value={answers.customer_outcome} />
          <ReviewItem label="Competitors" value={answers.competitors} />
        </ReviewSection>

        <ReviewSection title="Brand & voice">
          <ReviewItem label="Values" value={answers.brand_values} />
          <ReviewItem label="Voice tone" value={answers.voice_tone} />
          <ReviewItem label="Words to use" value={answers.words_to_use} />
          <ReviewItem label="Words to avoid" value={answers.words_to_avoid} />
          <ReviewItem label="Reference brands" value={answers.reference_brands} />
        </ReviewSection>

        <ReviewSection title="Visual identity">
          <ReviewItem label="Visual style" value={answers.visual_style} />
          <ReviewItem label="Primary colors" value={answers.primary_colors} />
          <ReviewItem
            label="Has logo"
            value={
              answers.has_logo === true
                ? "Yes"
                : answers.has_logo === false
                ? "No"
                : null
            }
          />
        </ReviewSection>
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <StepNavigation
        backUrl={getPreviousStepUrl("review")}
        isPending={isPending}
        isValid={true}
        onContinue={handleGenerate}
        continueLabel="Generate my content system"
        pendingLabel="Preparing…"
      />

      <p className="bp-hint text-center">
        You can edit any of this later inside Architecta.
      </p>
    </div>
  );
}
