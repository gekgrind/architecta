"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/auth/oauth";
import { Button } from "@/components/ui/button";

import { Github } from "lucide-react";

type OAuthProvider = "google" | "github";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // trigger entrance animation
    setMounted(true);
  }, []);

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

    router.push("/dashboard");
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    setError(null);

    const { error } = await signInWithProvider(provider);

    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#020617] to-[#020617] px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/20 blur-3xl" />
      </div>

      {/* Auth card */}
      <div
        className={[
          "w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl",
          "transition-all duration-700 ease-out",
          mounted
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-6 scale-[0.98]",
        ].join(" ")}
      >
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Sign in to continue building with Architecta
          </p>
        </div>

        {/* OAuth */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="flex w-full items-center justify-center gap-3 border-white/15 bg-white/5 text-white hover:bg-white/10"
            disabled={!!oauthLoading}
            onClick={() => handleOAuth("google")}
          >
            {/* Google icon */}
            <svg
              className="h-5 w-5"
              viewBox="0 0 48 48"
              aria-hidden
            >
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303C33.643 32.91 29.234 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.273 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.819C14.655 16.108 19.002 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.273 4 24 4c-7.682 0-14.344 4.281-17.694 10.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.191-5.238C29.104 35.091 26.654 36 24 36c-5.213 0-9.606-3.066-11.296-7.454l-6.518 5.025C9.505 39.556 16.227 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303c-1.087 2.883-3.153 5.321-5.783 6.565l.003-.002 6.191 5.238C35.287 39.556 40 35 40 24c0-1.341-.138-2.65-.389-3.917z"
              />
            </svg>

            {oauthLoading === "google"
              ? "Connecting to Google…"
              : "Continue with Google"}
          </Button>

          <Button
            variant="outline"
            className="flex w-full items-center justify-center gap-3 border-white/15 bg-white/5 text-white hover:bg-white/10"
            disabled={!!oauthLoading}
            onClick={() => handleOAuth("github")}
          >
            <Github className="h-5 w-5" />
            {oauthLoading === "github"
              ? "Connecting to GitHub…"
              : "Continue with GitHub"}
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-white/40">
          <div className="h-px flex-1 bg-white/10" />
          or sign in with email
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
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
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-teal-400 hover:underline"
          >
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
