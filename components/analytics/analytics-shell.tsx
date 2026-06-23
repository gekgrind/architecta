"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar as CalendarIcon,
  Film,
  ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";

type ApiPost = {
  id: string;
  platform: string;
  title: string | null;
  status: string;
  createdAt: string;
  publishedAt: string | null;
};

type ApiCampaign = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type ApiAsset = {
  id: string;
  postId: string | null;
  assetType: "image" | "video";
  signedUrl: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type LoadState = {
  posts: ApiPost[];
  campaigns: ApiCampaign[];
  assets: ApiAsset[];
};

const STATUS_ORDER = [
  "idea",
  "draft",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

function assetKind(asset: ApiAsset): "image" | "video" | "storyboard" {
  if (asset.assetType === "image") return "image";
  const status =
    asset.meta && typeof asset.meta === "object"
      ? (asset.meta as { status?: unknown }).status
      : undefined;
  return status === "storyboard" ? "storyboard" : "video";
}

function platformLabel(platform: string): string {
  if (platform === "x") return "X / Twitter";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function AnalyticsShell() {
  const [state, setState] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [postsRes, campaignsRes, assetsRes] = await Promise.all([
          fetch("/api/posts"),
          fetch("/api/campaigns"),
          fetch("/api/assets"),
        ]);
        const postsJson = (await postsRes.json().catch(() => null)) as
          | ApiResponse<{ posts: ApiPost[] }>
          | null;
        const campaignsJson = (await campaignsRes.json().catch(() => null)) as
          | ApiResponse<{ campaigns: ApiCampaign[] }>
          | null;
        const assetsJson = (await assetsRes.json().catch(() => null)) as
          | ApiResponse<{ assets: ApiAsset[] }>
          | null;

        if (!postsJson?.ok) {
          throw new Error(
            postsJson?.ok === false ? postsJson.error.message : "Failed to load posts"
          );
        }

        if (cancelled) return;
        setState({
          posts: postsJson.data.posts,
          campaigns: campaignsJson?.ok ? campaignsJson.data.campaigns : [],
          assets: assetsJson?.ok ? assetsJson.data.assets : [],
        });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Analytics load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregates = useMemo(() => {
    if (!state) return null;
    const byStatus = new Map<string, number>();
    const byPlatform = new Map<string, number>();
    for (const post of state.posts) {
      byStatus.set(post.status, (byStatus.get(post.status) ?? 0) + 1);
      byPlatform.set(post.platform, (byPlatform.get(post.platform) ?? 0) + 1);
    }
    const assets = {
      image: 0,
      video: 0,
      storyboard: 0,
    };
    for (const asset of state.assets) {
      assets[assetKind(asset)] += 1;
    }
    const activeCampaigns = state.campaigns.filter(
      (c) => c.status !== "complete" && c.status !== "archived"
    ).length;
    return {
      totalPosts: state.posts.length,
      published: byStatus.get("published") ?? 0,
      scheduled: byStatus.get("scheduled") ?? 0,
      drafts: (byStatus.get("draft") ?? 0) + (byStatus.get("idea") ?? 0),
      totalCampaigns: state.campaigns.length,
      activeCampaigns,
      assets,
      byStatus,
      byPlatform,
    };
  }, [state]);

  const recent = useMemo(() => {
    if (!state) return [];
    type Activity = {
      id: string;
      kind: "post" | "campaign" | "asset";
      label: string;
      detail: string;
      when: string;
    };
    const items: Activity[] = [];
    for (const post of state.posts.slice(0, 20)) {
      items.push({
        id: `post:${post.id}`,
        kind: "post",
        label: post.title ?? "Untitled post",
        detail: `${platformLabel(post.platform)} · ${post.status}`,
        when: post.createdAt,
      });
    }
    for (const campaign of state.campaigns.slice(0, 10)) {
      items.push({
        id: `campaign:${campaign.id}`,
        kind: "campaign",
        label: campaign.name,
        detail: `Campaign · ${campaign.status}`,
        when: campaign.createdAt,
      });
    }
    for (const asset of state.assets.slice(0, 10)) {
      const kind = assetKind(asset);
      items.push({
        id: `asset:${asset.id}`,
        kind: "asset",
        label:
          kind === "storyboard"
            ? "Storyboard generated"
            : kind === "video"
              ? "Video generated"
              : "Image generated",
        detail: asset.postId ? `Attached to post ${asset.postId.slice(0, 8)}…` : "Standalone asset",
        when: asset.createdAt,
      });
    }
    items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    return items.slice(0, 12);
  }, [state]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            How Architecta&apos;s output is stacking up.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (error || !aggregates) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4" />
            {error ?? "Could not load analytics."}
          </div>
        </div>
      </div>
    );
  }

  const platformBreakdown = Array.from(aggregates.byPlatform.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const statusBreakdown = STATUS_ORDER.map((s) => [s, aggregates.byStatus.get(s) ?? 0] as const);
  const maxPlatform = Math.max(1, ...platformBreakdown.map(([, n]) => n));
  const maxStatus = Math.max(1, ...statusBreakdown.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          A snapshot of what Architecta has produced for you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total posts" value={aggregates.totalPosts} />
        <MetricCard label="Published" value={aggregates.published} />
        <MetricCard label="Scheduled" value={aggregates.scheduled} />
        <MetricCard label="Drafts" value={aggregates.drafts} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Campaigns" value={aggregates.totalCampaigns} />
        <MetricCard label="Active campaigns" value={aggregates.activeCampaigns} />
        <MetricCard label="Images generated" value={aggregates.assets.image} />
        <MetricCard
          label="Videos / storyboards"
          value={aggregates.assets.video + aggregates.assets.storyboard}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Posts by platform
            </CardTitle>
            <CardDescription>Where Architecta has been writing lately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posts yet. Generate one from the Generate page.
              </p>
            ) : (
              platformBreakdown.map(([platform, count]) => (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">
                      {platformLabel(platform)}
                    </span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / maxPlatform) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" />
              Pipeline status
            </CardTitle>
            <CardDescription>
              Where your draft → published pipeline is sitting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBreakdown.every(([, n]) => n === 0) ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              statusBreakdown.map(([status, count]) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{status}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${(count / maxStatus) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            Recent activity
          </CardTitle>
          <CardDescription>
            Posts, campaigns, and assets in chronological order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {recent.map((activity) => {
                const Icon =
                  activity.kind === "campaign"
                    ? Megaphone
                    : activity.kind === "asset"
                      ? activity.label.startsWith("Storyboard")
                        ? Layers
                        : activity.label.startsWith("Video")
                          ? Film
                          : ImageIcon
                      : CalendarIcon;
                return (
                  <li
                    key={activity.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {activity.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(activity.when).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Engagement, reach, and ROI charts will appear here once external platform
        integrations land. For now, this view summarizes what Architecta has
        produced.
      </p>
    </div>
  );
}
