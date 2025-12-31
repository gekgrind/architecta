"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/auth/oauth";
import { Button } from "@/components/ui/button";
import { ArchitectaPrismBackground } from "@/components/backgrounds/ArchitectaPrismBackground";

type OAuthProvider = "google" | "github" | "apple" | "facebook";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) return setError(error.message);

    router.push("/dashboard");
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    setError(null);
    await signInWithProvider(provider);
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
          <h1 className="mb-6 text-center text-3xl font-semibold text-white">
            Welcome back
          </h1>

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
  );
}
