"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWebsiteStep } from "@/lib/onboarding/actions";

export default function WebsiteStep({ initialProfile, initialSession }: any) {
  const router = useRouter();
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(
    initialProfile.has_website ?? initialSession.flags?.hasWebsite ?? null
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile.website_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setLoading(true);
    setError(null);
    const res = await saveWebsiteStep({ hasWebsite, websiteUrl });
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    router.push(res.next);
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-3xl font-semibold">Connect your website</h1>
      <p className="text-slate-300 mt-2">
        If you connect your site, Architecta can auto-build most of your Brand Kit.
      </p>

      <div className="mt-6 space-y-3">
        <button
          className={`w-full rounded-xl border p-4 text-left ${hasWebsite === true ? "border-white" : "border-slate-800"}`}
          onClick={() => setHasWebsite(true)}
        >
          🌍 I have a website
        </button>
        <button
          className={`w-full rounded-xl border p-4 text-left ${hasWebsite === false ? "border-white" : "border-slate-800"}`}
          onClick={() => setHasWebsite(false)}
        >
          📁 I don’t have a website yet
        </button>
      </div>

      {hasWebsite === true && (
        <div className="mt-6">
          <label className="text-sm text-slate-300">Website URL</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourdomain.com"
            className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-800 p-3"
          />
          <p className="text-xs text-slate-400 mt-2">
            Tip: include the homepage. Architecta can find the rest.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-red-400">{error}</p>}

      <div className="mt-8 flex justify-end">
        <button
          disabled={loading || hasWebsite === null || (hasWebsite === true && !websiteUrl)}
          onClick={onContinue}
          className="rounded-xl bg-white text-slate-950 px-5 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
