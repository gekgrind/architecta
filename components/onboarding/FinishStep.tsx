"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/onboarding/actions";

const STATUS_MESSAGES = [
  "Finalizing your brand blueprint…",
  "Aligning voice, market, and visuals…",
  "Designing your content system…",
  "Preparing your studio…",
];

export default function FinishStep() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function runCompletion() {
      const result = await completeOnboarding();

      if (result?.ok && result.next) {
        router.replace(result.next);
      }
    }

    runCompletion();
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
      {/* Loader */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
      </div>

      {/* Status */}
      <p className="text-lg text-slate-300 transition-opacity duration-500">
        {STATUS_MESSAGES[messageIndex]}
      </p>

      {/* Subtext */}
      <p className="text-sm text-slate-500 max-w-sm">
        This usually takes just a few seconds.
      </p>
    </div>
  );
}
