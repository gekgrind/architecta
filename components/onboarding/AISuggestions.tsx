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
        className="bp-link"
      >
        Need help? Get AI suggestions →
      </button>
    );
  }

  return (
    <div className="bp-panel p-4 space-y-3">
      <div className="bp-hint text-xs uppercase tracking-wide">
        AI suggestions
      </div>

      {isPending && (
        <div className="text-sm text-[#aebdcf]" role="status">Thinking…</div>
      )}

      {error && (
        <div className="bp-error" role="alert">{error}</div>
      )}

      {content && (
        <div className="text-sm text-[#d3e0ec] whitespace-pre-line">
          {content}
        </div>
      )}

      {content && onApply && (
        <button
          type="button"
          onClick={() => onApply(content)}
          className="bp-link"
        >
          Use this
        </button>
      )}
    </div>
  );
}
