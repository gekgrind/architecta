"use client";

import { useCallback, useEffect, useState } from "react";
import FounderStyleEditor from "@/components/founder/FounderStyleEditor";

type FounderProfile = {
  profileText: string;
  confidenceScore: number;
  version: number;
};

export default function FounderStylePanel({
  workspaceId,
}: {
  workspaceId?: string | null;
}) {
  const [profile, setProfile] = useState<FounderProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/founder-style?workspaceId=${workspaceId ?? ""}`
    );
    const json = await res.json();
    setProfile(json.ok ? json.data.profile : null);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadProfile();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Loading founder style…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border p-4 text-sm">
        <p className="font-medium mb-2">Founder Style</p>
        <p className="text-muted-foreground">
          Your style profile will appear once the AI has learned from your edits.
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <FounderStyleEditor
        initialValue={profile.profileText}
        workspaceId={workspaceId}
        onDone={() => {
          setEditing(false);
          loadProfile();
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Your Founder Style</h3>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Edit
        </button>
      </div>

      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {profile.profileText}
      </pre>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Confidence: {(profile.confidenceScore * 100).toFixed(0)}%</span>
        <span>v{profile.version}</span>
      </div>
    </div>
  );
}
