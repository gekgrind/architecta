"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/auth/oauth";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { ArchitectaPrismBackground } from "@/components/backgrounds/ArchitectaPrismBackground";

type OAuthProvider = "google" | "github" | "apple" | "facebook";

export default function SignupPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) return setError(error.message);

    router.push("/onboarding");
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    setError(null);

    try {
      await signInWithProvider(provider);
    } catch {
      setError("Authentication failed. Please try again.");
      setOauthLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Prism background */}
      <ArchitectaPrismBackground />

      {/* Glass card */}
      <div
        className={[
          "relative z-10 w-full max-w-md rounded-3xl",
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Start building with Architecta
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
              label="Continue with Apple"
              icon={<AppleIcon />}
              variant="apple"
              loading={oauthLoading === "apple"}
              onClick={() => handleOAuth("apple")}
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

          <form onSubmit={handleSignup} className="space-y-4">
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
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-teal-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
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
  icon?: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: "apple" | "facebook";
}) {
  const glow =
    variant === "apple"
      ? "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_12px_40px_rgba(255,255,255,0.15)]"
      : variant === "facebook"
      ? "hover:shadow-[0_0_0_1px_rgba(24,119,242,0.5),0_12px_40px_rgba(24,119,242,0.3)]"
      : "";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={["glass-oauth", glow].join(" ")}
    >
      {icon}
      <span className="flex-1 text-sm font-medium">
        {loading ? "Connecting…" : label}
      </span>
    </button>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
      <path d="M16.365 1.43c0 1.14-.46 2.18-1.23 2.95-.78.78-1.94 1.37-3.02 1.28-.14-1.08.36-2.23 1.16-3.02.78-.78 2.04-1.36 3.09-1.21zM20.44 17.13c-.56 1.29-.83 1.87-1.56 3.03-1.02 1.59-2.46 3.56-4.23 3.57-1.56.01-1.96-.99-3.98-.99-2.02 0-2.46 1.01-4.02.99-1.77-.02-3.13-1.78-4.15-3.37-2.83-4.4-3.13-9.56-1.38-12.24 1.24-1.92 3.2-3.04 5.03-3.04 1.86 0 3.03 1.01 4.56 1.01 1.49 0 2.4-1.02 4.55-1.02 1.63 0 3.36.9 4.6 2.45-4.03 2.21-3.38 7.96.58 9.61z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1877F2]">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.017 4.388 11.01 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.953.93-1.953 1.887v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.083 24 18.09 24 12.073z" />
    </svg>
  );
}
