"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

type StepNavigationProps = {
  backUrl: string | null;
  isPending: boolean;
  isValid?: boolean;
  onContinue: () => void;
  continueLabel?: string;
  pendingLabel?: string;
};

export default function StepNavigation({
  backUrl,
  isPending,
  isValid = true,
  onContinue,
  continueLabel = "Continue",
  pendingLabel = "Saving…",
}: StepNavigationProps) {
  const router = useRouter();

  return (
    <div className="bp-nav">
      {backUrl && (
        <button
          type="button"
          className="bp-btn bp-btn-secondary"
          disabled={isPending}
          onClick={() => router.push(backUrl)}
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
        onClick={onContinue}
      >
        {isPending ? pendingLabel : continueLabel}
        {!isPending && <ArrowRight size={16} aria-hidden />}
      </button>
    </div>
  );
}
