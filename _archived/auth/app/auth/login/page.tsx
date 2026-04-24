"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/auth/oauth";
import type { OAuthProvider } from "@/lib/auth/oauth";
import { sanitizeAuthRedirectPath } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import ArchitectaPrismBackground from "@/components/backgrounds/ArchitectaPrismBackground";

function LoginContent() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const initialError = useMemo(() => {
    const errorMessage = searchParams.get("error") ?? searchParams.get("message");
    return errorMessage ? decodeURIComponent(errorMessage) : null;
  }, [searchParams]);

  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const safeNextPath = (() => {
    return sanitizeAuthRedirectPath(searchParams.get("next"));
  })();

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.replace(safeNextPath);
    router.refresh();
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    setError(null);

    const { error } = await signInWithProvider(provider, safeNextPath);

    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Prism background */}
      <div className="fixed inset-0 -z-10">
        <ArchitectaPrismBackground preset="auth" />
      </div>

      {/* Page content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div
          className={[
            "relative w-full max-w-md rounded-3xl",
            "border border-white/10 bg-white/5 backdrop-blur-xl",
            "shadow-2xl px-8 py-10",
            "transition-all duration-700 ease-out",
            mounted
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-6 scale-[0.97]",
          ].join(" ")}
        >
          {/* edge glow */}
          <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-teal-400/20 to-transparent blur-xl" />

          <div className="relative">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-semibold text-white">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Sign in to continue
              </p>
            </div>

            {/* OAuth */}
            <div className="space-y-3">
              <OAuthButton
                label="Continue with Google"
                loading={oauthLoading === "google"}
                onClick={() => handleOAuth("google")}
              />

              <OAuthButton
                label="Continue with GitHub"
                icon={<Github className="h-5 w-5" />}
                loading={oauthLoading === "github"}
                onClick={() => handleOAuth("github")}
              />

              <OAuthButton
                label="Continue with Facebook"
                icon={<FacebookIcon />}
                variant="facebook"
                loading={oauthLoading === "facebook"}
                onClick={() => handleOAuth("facebook")}
              />
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-white/40">
              <div className="h-px flex-1 bg-white/10" />
              or email
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                className="glass-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="glass-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                disabled={loading}
                className="w-full bg-teal-500 text-black hover:bg-teal-400"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-white/60">
              New here?{" "}
              <Link href="/auth/signup" className="text-teal-400 hover:underline">
                Start free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

/* ---------- Components ---------- */

function OAuthButton({
  label,
  icon,
  onClick,
  loading,
  variant,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: "facebook";
}) {
  const glow =
    variant === "facebook"
      ? "hover:shadow-[0_0_0_1px_rgba(24,119,242,0.5),0_12px_40px_rgba(24,119,242,0.3)]"
      : "";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={["glass-oauth", glow].join(" ")}
      type="button"
    >
      {icon}
      <span className="flex-1 text-sm font-medium">
        {loading ? "Connecting…" : label}
      </span>
    </button>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1877F2]">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.017 4.388 11.01 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.953.93-1.953 1.887v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.083 24 18.09 24 12.073z" />
    </svg>
  );
}
