"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ArchitectaPrismBackground from "@/components/backgrounds/ArchitectaPrismBackground";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Prism background */}
      <div className="fixed inset-0 -z-10">
        <ArchitectaPrismBackground preset="auth" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-8 py-10 shadow-2xl text-center">
          <h1 className="text-2xl font-semibold text-white">
            Check your email
          </h1>

          <p className="mt-4 text-sm text-white/70">
            We’ve sent you a confirmation link.
            Click it to finish creating your account.
          </p>

          <p className="mt-6 text-xs text-white/40">
            After confirming, you’ll be taken to onboarding automatically.
          </p>

          <Link
            href={`/auth/login?next=${encodeURIComponent(next)}`}
            className="mt-8 inline-block text-teal-400 hover:underline text-sm"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
