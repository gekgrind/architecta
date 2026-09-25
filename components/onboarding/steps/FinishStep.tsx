"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/onboarding/actions";

export default function FinishStep() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await completeOnboarding();
        if (!result.ok) {
          setError(result.error ?? "Something went wrong completing your setup.");
          return;
        }
        router.push(result.next ?? "/dashboard");
      } catch {
        setError("Something went wrong completing your setup. Please try again.");
      }
    });
  }, [router]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-400" role="alert">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            className="text-indigo-400 underline text-sm"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  const result = await completeOnboarding();
                  if (!result.ok) {
                    setError(result.error ?? "Something went wrong completing your setup.");
                    return;
                  }
                  router.push(result.next ?? "/dashboard");
                } catch {
                  setError("Something went wrong completing your setup. Please try again.");
                }
              });
            }}
          >
            Try again
          </button>
          <button
            type="button"
            className="text-slate-400 underline text-sm"
            onClick={() => router.push("/onboarding/review")}
          >
            Go back to review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-3">
      <p className="text-slate-400">
        {isPending ? "Building your brand system…" : "Architecta is ready to build your complete brand system."}
      </p>
    </div>
  );
}
