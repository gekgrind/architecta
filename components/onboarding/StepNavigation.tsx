"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

function toPreviewUrl(backUrl: string): string {
  const stepId = backUrl.replace("/onboarding/", "");
  return `/onboarding/preview?step=${stepId}`;
}

type StepNavigationProps = {
  backUrl: string | null;
  isPending: boolean;
  isValid?: boolean;
  onContinue: () => void;
  continueLabel?: string;
  pendingLabel?: string;
  disabledHint?: string;
};

export default function StepNavigation({
  backUrl,
  isPending,
  isValid = true,
  onContinue,
  continueLabel = "Continue",
  pendingLabel = "Saving…",
  disabledHint,
}: StepNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isPreview = pathname === "/onboarding/preview";
  const resolvedBackUrl = isPreview && backUrl ? toPreviewUrl(backUrl) : backUrl;
  const showHint = !isValid && !isPending && !!disabledHint;

  return (
    <div className="bp-nav-dock">
      <div className="bp-nav">
        {resolvedBackUrl && (
          <button
            type="button"
            className="bp-btn bp-btn-secondary"
            disabled={isPending}
            onClick={() => router.push(resolvedBackUrl)}
          >
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
        )}
        <button
          type="button"
          className="bp-btn bp-btn-primary"
          disabled={!isValid || isPending}
          aria-busy={isPending || undefined}
          aria-describedby={showHint ? "step-nav-hint" : undefined}
          onClick={onContinue}
        >
          {isPending ? pendingLabel : continueLabel}
          {!isPending && <ArrowRight size={16} aria-hidden />}
        </button>
      </div>
      {showHint && (
        <p id="step-nav-hint" className="bp-hint text-center">
          {disabledHint}
        </p>
      )}
    </div>
  );
}
