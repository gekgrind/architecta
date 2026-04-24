"use client";

import { useState, useTransition } from "react";
import { getOnboardingSuggestions } from "@/lib/ai/onboardingSuggestions";

type Props = {
  step: string;
  context: Record<string, unknown>;
  onApply?: (suggestion: string) => void;
};

export default function AISuggestions({
  step,
  context,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setOpen(true);
    setError(null);
    setContent(null);

    startTransition(async () => {
      const res = await getOnboardingSuggestions({ step, context });

      if (res.ok && typeof res.suggestions === "string") {
        setContent(res.suggestions);
      } else {
        setError("Unable to generate suggestions right now.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        className="text-sm text-indigo-400 hover:text-indigo-300 transition"
      >
        Need help? Get AI suggestions →
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        AI suggestions
      </div>

      {isPending && (
        <div className="text-sm text-slate-400">Thinking…</div>
      )}

      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      {content && (
        <div className="text-sm text-slate-300 whitespace-pre-line">
          {content}
        </div>
      )}

      {content && onApply && (
        <button
          type="button"
          onClick={() => onApply(content)}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Use this
        </button>
      )}
    </div>
  );
}
