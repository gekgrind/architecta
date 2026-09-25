"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  const showHint = !isValid && !isPending && !!disabledHint;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 md:static md:mx-0 md:px-0 md:pb-0 md:pt-0 bg-[#0a1628]/95 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none space-y-2">
      <div className="flex gap-3">
        {backUrl && (
          <Button
            variant="outline"
            size="lg"
            className="flex-shrink-0"
            disabled={isPending}
            onClick={() => router.push(backUrl)}
          >
            Back
          </Button>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!isValid || isPending}
          onClick={onContinue}
          aria-describedby={showHint ? "step-nav-hint" : undefined}
        >
          {isPending ? pendingLabel : continueLabel}
        </Button>
      </div>
      {showHint && (
        <p id="step-nav-hint" className="text-sm text-slate-400 text-center">
          {disabledHint}
        </p>
      )}
    </div>
  );
}
