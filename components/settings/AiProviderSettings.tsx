"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type TextProvider = "anthropic" | "openai" | "auto";
type Platform =
  | "linkedin"
  | "instagram"
  | "x"
  | "facebook"
  | "tiktok"
  | "pinterest"
  | "youtube"
  | "blog"
  | "email"
  | "threads";

type Settings = {
  textProvider: TextProvider;
  anthropicModel: string;
  openaiTextModel: string;
  openaiImageModel: string;
  openaiVideoModel: string | null;
  defaultPlatforms: Platform[];
  approvalRequired: boolean;
};

const ANTHROPIC_MODELS = [
  { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (default)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

const OPENAI_TEXT_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (default)" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
];

const OPENAI_IMAGE_MODELS = [
  { value: "gpt-image-1", label: "gpt-image-1 (default)" },
  { value: "dall-e-3", label: "DALL·E 3" },
];

const OPENAI_VIDEO_MODELS = [
  { value: "__none__", label: "Storyboard fallback only" },
  { value: "sora-2", label: "Sora 2" },
  { value: "sora-2-pro", label: "Sora 2 Pro" },
];

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X / Twitter" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
  { value: "threads", label: "Threads" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
];

const DEFAULT_SETTINGS: Settings = {
  textProvider: "anthropic",
  anthropicModel: "claude-sonnet-4-6",
  openaiTextModel: "gpt-4o",
  openaiImageModel: "gpt-image-1",
  openaiVideoModel: null,
  defaultPlatforms: ["linkedin", "instagram", "x"],
  approvalRequired: false,
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function diff(a: Settings, b: Settings): Partial<Settings> {
  const out: Partial<Settings> = {};
  (Object.keys(b) as Array<keyof Settings>).forEach((key) => {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      // @ts-expect-error - structural copy is safe per-key
      out[key] = b[key];
    }
  });
  return out;
}

export function AiProviderSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const initialRef = useRef<Settings>(DEFAULT_SETTINGS);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ settings: Settings }>;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error.message);
        } else {
          const loaded: Settings = {
            textProvider: json.data.settings.textProvider,
            anthropicModel: json.data.settings.anthropicModel,
            openaiTextModel: json.data.settings.openaiTextModel,
            openaiImageModel: json.data.settings.openaiImageModel,
            openaiVideoModel: json.data.settings.openaiVideoModel,
            defaultPlatforms: json.data.settings.defaultPlatforms,
            approvalRequired: json.data.settings.approvalRequired,
          };
          initialRef.current = loaded;
          setSettings(loaded);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => Object.keys(diff(initialRef.current, settings)).length > 0,
    [settings]
  );

  async function save() {
    const patch = diff(initialRef.current, settings);
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as ApiResponse<{ settings: Settings }>;
      if (!json.ok) {
        setError(json.error.message);
        toast({
          title: "Could not save settings",
          description: json.error.message,
          variant: "destructive",
        });
        return;
      }
      const fresh: Settings = {
        textProvider: json.data.settings.textProvider,
        anthropicModel: json.data.settings.anthropicModel,
        openaiTextModel: json.data.settings.openaiTextModel,
        openaiImageModel: json.data.settings.openaiImageModel,
        openaiVideoModel: json.data.settings.openaiVideoModel,
        defaultPlatforms: json.data.settings.defaultPlatforms,
        approvalRequired: json.data.settings.approvalRequired,
      };
      initialRef.current = fresh;
      setSettings(fresh);
      toast({
        title: "Settings saved",
        description: "Your AI preferences are now active.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function togglePlatform(platform: Platform, checked: boolean) {
    setSettings((prev) => {
      const set = new Set(prev.defaultPlatforms);
      if (checked) set.add(platform);
      else set.delete(platform);
      return { ...prev, defaultPlatforms: Array.from(set) as Platform[] };
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg border border-border bg-background" />
        <div className="h-32 animate-pulse rounded-lg border border-border bg-background" />
        <div className="h-20 animate-pulse rounded-lg border border-border bg-background" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <Label className="text-base">Text generation provider</Label>
          <p className="text-sm text-muted-foreground">
            Which LLM Architecta uses for strategy, posts, captions, and brand work.
          </p>
        </div>
        <RadioGroup
          value={settings.textProvider}
          onValueChange={(value) =>
            setSettings((prev) => ({
              ...prev,
              textProvider: value as TextProvider,
            }))
          }
          className="grid gap-3 sm:grid-cols-3"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 hover:border-primary/40">
            <RadioGroupItem value="anthropic" className="mt-0.5" />
            <span className="space-y-1">
              <span className="block font-medium">Anthropic (Claude)</span>
              <span className="block text-xs text-muted-foreground">
                Best for long-form brand work and reasoning.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 hover:border-primary/40">
            <RadioGroupItem value="openai" className="mt-0.5" />
            <span className="space-y-1">
              <span className="block font-medium">OpenAI (GPT)</span>
              <span className="block text-xs text-muted-foreground">
                Faster for short copy and quick iterations.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 hover:border-primary/40">
            <RadioGroupItem value="auto" className="mt-0.5" />
            <span className="space-y-1">
              <span className="block font-medium">Auto-route</span>
              <span className="block text-xs text-muted-foreground">
                Let the gateway pick per task.
              </span>
            </span>
          </label>
        </RadioGroup>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="anthropic-model">Anthropic model</Label>
          <Select
            value={settings.anthropicModel}
            onValueChange={(value) =>
              setSettings((prev) => ({ ...prev, anthropicModel: value }))
            }
          >
            <SelectTrigger id="anthropic-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANTHROPIC_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openai-text-model">OpenAI text model</Label>
          <Select
            value={settings.openaiTextModel}
            onValueChange={(value) =>
              setSettings((prev) => ({ ...prev, openaiTextModel: value }))
            }
          >
            <SelectTrigger id="openai-text-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_TEXT_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openai-image-model">Image generation model</Label>
          <Select
            value={settings.openaiImageModel}
            onValueChange={(value) =>
              setSettings((prev) => ({ ...prev, openaiImageModel: value }))
            }
          >
            <SelectTrigger id="openai-image-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_IMAGE_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openai-video-model">Video generation model</Label>
          <Select
            value={settings.openaiVideoModel ?? "__none__"}
            onValueChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                openaiVideoModel: value === "__none__" ? null : value,
              }))
            }
          >
            <SelectTrigger id="openai-video-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_VIDEO_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            If your OpenAI tier can&apos;t reach Sora, Architecta falls back to a
            structured storyboard JSON.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <Label className="text-base">Default platforms</Label>
          <p className="text-sm text-muted-foreground">
            Pre-selected when you start a new post or campaign.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((p) => {
            const checked = settings.defaultPlatforms.includes(p.value);
            return (
              <label
                key={p.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(state) =>
                    togglePlatform(p.value, state === true)
                  }
                />
                <span className="text-sm font-medium">{p.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="flex items-start justify-between rounded-lg border border-border bg-background p-4">
        <div className="space-y-1">
          <Label htmlFor="approval-required" className="text-base">
            Require approval before publishing
          </Label>
          <p className="text-sm text-muted-foreground">
            Generated posts land in <span className="font-medium">draft</span>{" "}
            and need a manual approve step before they can be scheduled.
          </p>
        </div>
        <Switch
          id="approval-required"
          checked={settings.approvalRequired}
          onCheckedChange={(checked) =>
            setSettings((prev) => ({ ...prev, approvalRequired: checked }))
          }
        />
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {dirty && !saving && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
