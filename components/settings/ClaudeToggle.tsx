"use client";

import { useState } from "react";
import { setClaudePreference } from "@/lib/ai/actions/preferences";

export function ClaudeToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await setClaudePreference(!enabled);
    setEnabled(!enabled);
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 p-4">
      <div>
        <p className="font-medium">Use Claude for deep brand work</p>
        <p className="text-sm text-slate-400">
          Best for long-form strategy, brand voice, and positioning
        </p>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        className={`h-6 w-12 rounded-full transition ${
          enabled ? "bg-indigo-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transition ${
            enabled ? "translate-x-6" : ""
          }`}
        />
      </button>
    </div>
  );
}
