"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, Newspaper, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DestinationPublisher } from "@/components/integrations/DestinationPublisher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Post = {
  id: string;
  title: string | null;
  platform: string;
  caption: string | null;
  hook: string | null;
  status: string;
  scheduledFor: string | null;
};

type CalendarItem = {
  id: string;
  postId: string | null;
  platform: string;
  scheduledFor: string;
  status: string;
  notes: string | null;
  /** The linked post's publishing state (calendar status alone can't show failures). */
  postStatus?: string | null;
  publishError?: string | null;
  publishErrorCode?: string | null;
};

function startOfDayKey(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function defaultScheduleTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  // datetime-local expects YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarShell() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  // Which draft has the blog/email destination panel expanded.
  const [publisherOpen, setPublisherOpen] = useState<string | null>(null);
  const [pickerWhen, setPickerWhen] = useState(defaultScheduleTime());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [postsRes, itemsRes] = await Promise.all([
        fetch("/api/posts?status=draft"),
        fetch("/api/calendar"),
      ]);
      const postsJson = (await postsRes.json().catch(() => null)) as
        | { ok?: boolean; data?: { posts: Post[] }; error?: { message?: string } }
        | null;
      const itemsJson = (await itemsRes.json().catch(() => null)) as
        | { ok?: boolean; data?: { items: CalendarItem[] }; error?: { message?: string } }
        | null;
      if (!postsRes.ok || !postsJson?.ok) {
        throw new Error(postsJson?.error?.message ?? "Could not load posts");
      }
      if (!itemsRes.ok || !itemsJson?.ok) {
        throw new Error(itemsJson?.error?.message ?? "Could not load calendar");
      }
      setPosts(postsJson.data?.posts ?? []);
      setItems(itemsJson.data?.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function schedulePost(post: Post) {
    setScheduling(post.id);
    setError(null);
    try {
      const isoLocal = new Date(pickerWhen).toISOString();
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          platform: post.platform,
          scheduledFor: isoLocal,
          status: "scheduled",
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Schedule failed");
      }
      setPickerOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setScheduling(null);
    }
  }

  async function patchItem(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Update failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function publishNow(item: CalendarItem) {
    if (!item.postId) return;
    setPublishing(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${item.postId}/publish`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Publish failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(null);
    }
  }

  async function deleteItem(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Delete failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = startOfDayKey(item.scheduledFor);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Schedule draft posts and track what&apos;s going out and when.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Drafts ready to schedule
            </CardTitle>
            <CardDescription>
              Saved posts that don&apos;t have a slot yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg border border-border bg-card"
                />
              ))
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drafts waiting. Generate content from the Generate page.
              </p>
            ) : (
              posts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {p.title ?? "Untitled"}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {p.platform}
                      </p>
                      {p.hook && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {p.hook}
                        </p>
                      )}
                    </div>
                    {pickerOpen === p.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="datetime-local"
                          value={pickerWhen}
                          onChange={(e) => setPickerWhen(e.target.value)}
                          className="h-8 w-[200px]"
                        />
                        <Button
                          size="sm"
                          onClick={() => schedulePost(p)}
                          disabled={scheduling === p.id}
                          className="gap-1"
                        >
                          {scheduling === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Schedule
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() =>
                            setPublisherOpen(publisherOpen === p.id ? null : p.id)
                          }
                        >
                          <Newspaper className="h-3 w-3" />
                          Blog / Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPickerOpen(p.id);
                            setPickerWhen(defaultScheduleTime());
                          }}
                        >
                          Schedule
                        </Button>
                      </div>
                    )}
                  </div>

                  {publisherOpen === p.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      <DestinationPublisher postId={p.id} />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              Scheduled
            </CardTitle>
            <CardDescription>
              Upcoming and past items, grouped by day.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-lg border border-border bg-card"
                />
              ))
            ) : groupedByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled yet.
              </p>
            ) : (
              groupedByDay.map(([day, dayItems]) => (
                <div key={day} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {new Date(day).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-background p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="capitalize">{item.platform}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.scheduledFor).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Select
                          value={item.status}
                          onValueChange={(v) => patchItem(item.id, { status: v })}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="idea">Idea</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                        {item.postId && item.status !== "published" && item.postStatus !== "publishing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => publishNow(item)}
                            disabled={publishing === item.id}
                            className="gap-1"
                          >
                            {publishing === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {item.postStatus === "failed" ? "Retry" : "Publish"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.postStatus === "publishing" && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Publishing…
                        </p>
                      )}
                      {item.postStatus === "failed" && (
                        <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                          <p>{item.publishError ?? "Publishing failed. Please try again."}</p>
                          {item.publishErrorCode === "reconnect_required" && (
                            <a
                              href={`/api/connections/${item.platform}/start`}
                              className="mt-1 inline-block font-medium underline"
                            >
                              Reconnect {item.platform}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
