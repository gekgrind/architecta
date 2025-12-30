"use client";

import { useState } from "react";

export default function FounderStyleEditor({
  initialValue,
  workspaceId,
  onDone,
}: {
  initialValue: string;
  workspaceId?: string | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/founder-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        profileText: value,
      }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Edit Founder Style</h3>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={10}
        className="w-full rounded-md border p-2 text-sm"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          className="text-sm text-muted-foreground"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
