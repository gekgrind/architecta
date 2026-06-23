"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const PLATFORM_OPTIONS = [
  "linkedin",
  "instagram",
  "x",
  "facebook",
  "tiktok",
  "pinterest",
  "youtube",
];

type Campaign = {
  id: string;
  name: string;
  theme: string | null;
  goal: string | null;
  launchDate: string | null;
  status: string;
  postCount: number;
  createdAt: string;
};

type Form = {
  name: string;
  theme: string;
  goal: string;
  launchDate: string;
  platforms: string[];
  postsPerPlatform: number;
  includeEmail: boolean;
  includeBlog: boolean;
};

const initialForm: Form = {
  name: "",
  theme: "",
  goal: "",
  launchDate: "",
  platforms: ["linkedin", "instagram"],
  postsPerPlatform: 3,
  includeEmail: true,
  includeBlog: false,
};

export function CampaignsShell() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { campaigns: Campaign[] }; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? `Failed to load (${res.status})`);
      }
      setCampaigns(json.data?.campaigns ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function togglePlatform(platform: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.theme.trim() || !form.goal.trim()) {
      setError("Name, theme, and goal are required.");
      return;
    }
    if (form.platforms.length === 0) {
      setError("Pick at least one platform.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          theme: form.theme,
          goal: form.goal,
          launchDate: form.launchDate || null,
          platforms: form.platforms,
          postsPerPlatform: form.postsPerPlatform,
          includeEmail: form.includeEmail,
          includeBlog: form.includeBlog,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? `Create failed (${res.status})`);
      }
      setForm(initialForm);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Generate a multi-post launch sequence with one brief.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New campaign"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Campaign brief
            </CardTitle>
            <CardDescription>
              Architecta will generate the launch sequence and every post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Spring product launch"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Launch date</label>
                <Input
                  type="date"
                  value={form.launchDate}
                  onChange={(e) => setForm({ ...form, launchDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Theme</label>
              <Input
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                placeholder="What's the big idea this campaign sells?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Goal</label>
              <Textarea
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="What outcome should this campaign drive?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Platforms</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.platforms.includes(p)}
                      onCheckedChange={() => togglePlatform(p)}
                    />
                    <span className="capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Posts per platform
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.postsPerPlatform}
                  onChange={(e) =>
                    setForm({ ...form, postsPerPlatform: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <label className="flex items-center gap-2 self-end text-sm">
                <Checkbox
                  checked={form.includeEmail}
                  onCheckedChange={(c) =>
                    setForm({ ...form, includeEmail: Boolean(c) })
                  }
                />
                Include email
              </label>
              <label className="flex items-center gap-2 self-end text-sm">
                <Checkbox
                  checked={form.includeBlog}
                  onCheckedChange={(c) =>
                    setForm({ ...form, includeBlog: Boolean(c) })
                  }
                />
                Include blog
              </label>
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-full gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating campaign…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate campaign
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold">No campaigns yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start a campaign brief and Architecta will fan it out into every
              post, email, and angle.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    {c.theme && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {c.theme}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.postCount} posts</span>
                  <span>
                    {c.launchDate
                      ? new Date(c.launchDate).toLocaleDateString()
                      : new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
