"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Plug, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ConnectionSummary = {
  externalAccountName: string | null;
  status: string;
  expiresAt: string | null;
};

type PlatformEntry = {
  platform: string;
  implemented: boolean;
  connection: ConnectionSummary | null;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export function PlatformConnections() {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ platforms: PlatformEntry[] }>;
      if (!json.ok) {
        setError(json.error.message);
      } else {
        setPlatforms(json.data.platforms);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Surface the OAuth callback result (?connection=linkedin&result=connected|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("connection");
    const result = params.get("result");
    if (platform && result) {
      const label = PLATFORM_LABELS[platform] ?? platform;
      if (result === "connected") {
        toast({ title: `${label} connected`, description: "You can now publish to it." });
      } else {
        toast({
          title: `Couldn't connect ${label}`,
          description: "The authorization didn't complete. Please try again.",
          variant: "destructive",
        });
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("connection");
      url.searchParams.delete("result");
      window.history.replaceState({}, "", url.toString());
    }
  }, [toast]);

  function connect(platform: string) {
    // Full-page navigation to the OAuth start endpoint (it redirects to the provider).
    window.location.href = `/api/connections/${platform}/start`;
  }

  async function disconnect(platform: string) {
    setBusy(platform);
    try {
      const res = await fetch(`/api/connections/${platform}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ disconnected: boolean }>;
      if (!json.ok) {
        toast({
          title: "Disconnect failed",
          description: json.error.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: `${PLATFORM_LABELS[platform] ?? platform} disconnected` });
      await load();
    } catch (err) {
      toast({
        title: "Disconnect failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border bg-background"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {platforms.map((entry) => {
        const label = PLATFORM_LABELS[entry.platform] ?? entry.platform;
        const connected =
          entry.connection && entry.connection.status === "connected";
        return (
          <div
            key={entry.platform}
            className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{label}</p>
                {connected ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-3 w-3" />
                    {entry.connection?.externalAccountName
                      ? `Connected as ${entry.connection.externalAccountName}`
                      : "Connected"}
                  </p>
                ) : entry.connection ? (
                  <p className="text-xs text-amber-600">
                    Needs reconnect ({entry.connection.status})
                  </p>
                ) : entry.implemented ? (
                  <p className="text-xs text-muted-foreground">Not connected</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                )}
              </div>
            </div>

            {connected ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => disconnect(entry.platform)}
                disabled={busy === entry.platform}
              >
                {busy === entry.platform ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => connect(entry.platform)}
                disabled={!entry.implemented}
              >
                <Plug className="h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Connect an account to publish posts directly from Architecta. Scheduled
        posts publish automatically once a platform is connected.
      </p>
    </div>
  );
}
