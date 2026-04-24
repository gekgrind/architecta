"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateArchitectaOnboarding,
  setArchitectaOnboardingStep,
} from "@/lib/onboarding/actions";

type CustomersStepProps = {
  initialProfile: {
    customer_role?: string | null;
    customer_pains?: string[] | null;
    customer_outcome?: string | null;
  };
  initialSession: {
    id: string;
  };
};

const PAIN_OPTIONS = [
  "Lack of clarity",
  "Inconsistent content",
  "Low engagement",
  "No time to create content",
  "Unclear positioning",
  "Not converting attention into customers",
];

export default function CustomersStep({ initialProfile }: CustomersStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [role, setRole] = useState(
    initialProfile.customer_role ?? ""
  );
  const [pains, setPains] = useState<string[]>(
    initialProfile.customer_pains ?? []
  );
  const [outcome, setOutcome] = useState(
    initialProfile.customer_outcome ?? ""
  );

  const isValid =
    role.trim().length > 0 &&
    pains.length > 0 &&
    outcome.trim().length > 0;

  function togglePain(pain: string) {
    setPains((prev) =>
      prev.includes(pain)
        ? prev.filter((p) => p !== pain)
        : [...prev, pain]
    );
  }

  function handleContinue() {
    if (!isValid) return;

    startTransition(async () => {
      await updateArchitectaOnboarding({
        customer_role: role.trim(),
        customer_pains: pains,
        customer_outcome: outcome.trim(),
      });

      await setArchitectaOnboardingStep("customers");

      router.push("/onboarding/foundation");
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Who are you creating for?
        </h1>
        <p className="text-slate-400 text-lg">
          Clear customer insight makes content convert.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Customer role */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Your ideal customer
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Solo founders, busy professionals, local business owners…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Pain points */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            What are they struggling with?
          </label>

          <div className="grid gap-2">
            {PAIN_OPTIONS.map((pain) => {
              const active = pains.includes(pain);

              return (
                <button
                  key={pain}
                  type="button"
                  onClick={() => togglePain(pain)}
                  className={`rounded-lg border px-4 py-2 text-left transition
                    ${
                      active
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                  <span className="text-sm text-white">{pain}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desired outcome */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            What outcome do they want?
          </label>
          <textarea
            rows={3}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What does success look like for them?"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
          />
        </div>
      </div>

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
