"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DestinationEntry = {
  destination: string;
  label: string;
  kind: "cms" | "email";
  implemented: boolean;
  connection: { status: string } | null;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type Outcome = {
  status: string;
  externalId: string;
  externalUrl: string | null;
};

/**
 * Hands one saved post to a connected blog or email destination.
 *
 * Two deliberately separate actions, mirroring the API: "Create draft" puts the
 * content in the destination's own editor and never goes live, while the send /
 * publish button is the explicit approval the /publish route requires. Drafting
 * first is the default path — the id it returns is reused so the approval
 * promotes the very draft the user reviewed, rather than posting a second copy.
 */
export function DestinationPublisher({
  postId,
  onDone,
}: {
  postId: string;
  onDone?: () => void;
}) {
  const [destinations, setDestinations] = useState<DestinationEntry[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState("");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [brevoLists, setBrevoLists] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ destinations: DestinationEntry[] }>;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error.message);
          return;
        }
        const connected = json.data.destinations.filter(
          (d) => d.connection?.status === "connected"
        );
        setDestinations(connected);
        if (connected.length === 1) setSelected(connected[0].destination);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load destinations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entry = destinations.find((d) => d.destination === selected) ?? null;
  const isEmail = entry?.kind === "email";
  const isBrevo = selected === "brevo";

  // Brevo campaigns go to a contact list, so fetch the ids the user actually has.
  useEffect(() => {
    if (!isBrevo) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/integrations/brevo/lists`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ lists: Array<{ id: number; name: string }> }>;
      if (!cancelled && json.ok) setBrevoLists(json.data.lists);
    })();
    return () => {
      cancelled = true;
    };
  }, [isBrevo]);

  // A destination switch invalidates any draft made in the previous one.
  function selectDestination(next: string) {
    setSelected(next);
    setOutcome(null);
    setError(null);
    setAudience("");
  }

  function splitList(value: string): string[] {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function overrides(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (title.trim()) body.title = title.trim();
    if (isEmail) {
      if (subject.trim()) body.subject = subject.trim();
      if (audience.trim()) body.audience = audience.trim();
    } else {
      if (slug.trim()) body.slug = slug.trim();
      if (tags.trim()) body.tags = splitList(tags);
      if (categories.trim()) body.categories = splitList(categories);
    }
    return body;
  }

  async function run(action: "draft" | "publish") {
    if (!selected) return;
    setBusy(action);
    setError(null);
    try {
      const body: Record<string, unknown> = { postId, ...overrides() };
      if (action === "publish") {
        // The route requires this literal — clicking the button is the approval.
        body.approved = true;
        // Promote the draft the user just reviewed instead of posting a copy.
        if (outcome?.externalId) body.externalId = outcome.externalId;
        if (scheduledFor) body.scheduledFor = new Date(scheduledFor).toISOString();
      }

      const res = await fetch(`/api/integrations/${selected}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<Outcome>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setOutcome(json.data);
      if (action === "publish") onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action}`);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-lg border border-border bg-card" />
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        No blog or email destination is connected yet. Add one in Settings → Blog &amp; Email.
      </div>
    );
  }

  const sendLabel = isEmail ? "Send now" : "Publish now";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Destination</label>
        <Select value={selected} onValueChange={selectDestination}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose where this goes" />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((d) => (
              <SelectItem key={d.destination} value={d.destination}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entry && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use the post title"
              className="h-9"
            />
          </div>

          {isEmail ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Subject (optional)
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Leave blank to use the title"
                  className="h-9"
                />
              </div>
              {isBrevo ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Contact list
                  </label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={
                          brevoLists.length ? "Choose a Brevo list" : "Loading lists…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {brevoLists.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Recipients
                  </label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="someone@example.com, another@example.com"
                    className="h-9"
                    autoComplete="off"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Slug (optional)
                </label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Categories
                </label>
                <Input
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  placeholder="News, Guides"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tags</label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="saas, founders"
                  className="h-9"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Schedule for later (optional)
            </label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-9"
            />
          </div>

          {outcome && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-700">
              <span className="font-medium capitalize">{outcome.status}</span>
              {outcome.externalUrl && (
                <>
                  {" — "}
                  <a
                    href={outcome.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    open it
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => run("draft")}
              disabled={busy !== null}
            >
              {busy === "draft" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Create draft
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => run("publish")}
              disabled={busy !== null}
            >
              {busy === "publish" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {scheduledFor ? "Schedule" : sendLabel}
            </Button>
            <span className="text-xs text-muted-foreground">
              Drafting is safe — nothing leaves your account until you use {sendLabel.toLowerCase()}.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
