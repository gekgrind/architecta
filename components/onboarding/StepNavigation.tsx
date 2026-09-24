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
      >
        {isPending ? pendingLabel : continueLabel}
      </Button>
    </div>
  );
}
