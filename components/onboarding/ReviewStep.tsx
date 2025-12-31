"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setArchitectaOnboardingStep } from "@/lib/onboarding/actions";

type ReviewStepProps = {
  initialProfile: any;
  initialSession: {
    id: string;
  };
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
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm text-white">
        {Array.isArray(value) ? value.join(", ") : value}
      </div>
    </div>
  );
}

export default function ReviewStep({ initialProfile }: ReviewStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      await setArchitectaOnboardingStep("review");
      router.push("/onboarding/finish");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Review your setup
        </h1>
        <p className="text-slate-400 text-lg">
          This is the system Architecta will generate from.
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <ReviewItem label="Brand name" value={initialProfile.brand_name} />
        <ReviewItem label="Industry" value={initialProfile.industry} />
        <ReviewItem label="Description" value={initialProfile.description} />

        <ReviewItem label="Primary market" value={initialProfile.primary_market} />
        <ReviewItem label="Niche" value={initialProfile.niche} />
        <ReviewItem label="Competitors" value={initialProfile.competitors} />

        <ReviewItem label="Customer" value={initialProfile.customer_role} />
        <ReviewItem label="Pain points" value={initialProfile.customer_pains} />
        <ReviewItem label="Desired outcome" value={initialProfile.customer_outcome} />

        <ReviewItem label="Values" value={initialProfile.brand_values} />
        <ReviewItem label="Voice tone" value={initialProfile.voice_tone} />
        <ReviewItem label="Visual style" value={initialProfile.visual_style} />
        <ReviewItem label="Primary colors" value={initialProfile.primary_colors} />
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        disabled={isPending}
        onClick={handleGenerate}
      >
        {isPending ? "Preparing…" : "Generate my content system"}
      </Button>

      {/* Subtext */}
      <p className="text-center text-sm text-slate-500">
        You can edit any of this later inside Architecta.
      </p>
    </div>
  );
}
