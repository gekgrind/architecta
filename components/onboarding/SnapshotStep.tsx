"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";
import AISuggestions from "@/components/onboarding/AISuggestions";

type SnapshotStepProps = {
  initialProfile: {
    brand_name?: string | null;
    industry?: string | null;
    description?: string | null;
  };
  initialSession: {
    id: string;
  };
};

export default function SnapshotStep({
  initialProfile,
}: SnapshotStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [brandName, setBrandName] = useState(
    initialProfile.brand_name ?? ""
  );
  const [industry, setIndustry] = useState(
    initialProfile.industry ?? ""
  );
  const [description, setDescription] = useState(
    initialProfile.description ?? ""
  );

  const isValid =
    brandName.trim().length > 0 &&
    industry.trim().length > 0 &&
    description.trim().length > 0;

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      // Save snapshot fields
      await updateArchitectaOnboarding({
        brand_name: brandName.trim(),
        industry: industry.trim(),
        description: description.trim(),
      });

      // Advance step
      await setArchitectaOnboardingStep("snapshot");

      router.push("/onboarding/market");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Brand snapshot
        </h1>
        <p className="text-slate-400 text-lg">
          This is the foundation Architecta builds everything on.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Brand name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Brand or business name
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Studio"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Industry
          </label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="SaaS, wellness, ecommerce, creator, etc."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            What do you do?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Explain it like you would to a smart friend."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      <AISuggestions
  step="snapshot"
  context={{
    brand_name: brandName,
    industry,
  }}
  onApply={(text) => setDescription(text)}
/>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        disabled={!isValid || isPending}
        onClick={handleContinue}
      >
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
