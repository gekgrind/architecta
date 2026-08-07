"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Globe,
  Loader2,
  Mail,
  Plug,
  Send,
  Unplug,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type DestinationConnection = {
  externalAccountName: string | null;
  config: Record<string, string>;
  status: string;
};

type DestinationEntry = {
  destination: string;
  label: string;
  kind: "cms" | "email";
  connectMethod: "credentials" | "oauth";
  implemented: boolean;
  connection: DestinationConnection | null;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const DESTINATION_ICONS: Record<string, typeof Globe> = {
  wordpress: Globe,
  ghost: Globe,
  custom: Webhook,
  gmail: Mail,
  microsoft: Mail,
  brevo: Send,
};

const DESTINATION_LABELS: Record<string, string> = {
  wordpress: "WordPress",
  ghost: "Ghost",
  custom: "Custom site",
  gmail: "Gmail",
  microsoft: "Outlook",
  brevo: "Brevo",
};

type ConnectField = {
  name: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  /** Blank is allowed — the backend falls back to a sensible default. */
  optional?: boolean;
};

/**
 * The connect form for each credential-based destination. Field names match
 * the zod schemas in lib/validation/integrations.ts exactly, so the form body
 * posts straight through without a mapping layer.
 */
const CONNECT_FIELDS: Record<string, { fields: ConnectField[]; hint: string }> = {
  wordpress: {
    fields: [
      { name: "siteUrl", label: "Site URL", placeholder: "https://yoursite.com" },
      { name: "username", label: "Username", placeholder: "your-wordpress-username" },
      {
        name: "applicationPassword",
        label: "Application password",
        type: "password",
        placeholder: "xxxx xxxx xxxx xxxx",
      },
    ],
    hint: "Create this in WordPress under Users → Profile → Application Passwords. Never use your main account password.",
  },
  ghost: {
    fields: [
      { name: "siteUrl", label: "Site URL", placeholder: "https://yourblog.com" },
      {
        name: "adminApiKey",
        label: "Admin API key",
        type: "password",
        placeholder: "6412a1b…:9f2c…",
      },
    ],
    hint: "In Ghost: Settings → Integrations → Add custom integration. Copy the Admin API key (it looks like id:secret) — the Content API key is read-only and can't create posts.",
  },
  custom: {
    fields: [
      {
        name: "webhookUrl",
        label: "Webhook URL",
        placeholder: "https://yoursite.com/api/posts",
      },
      {
        name: "authHeader",
        label: "Auth header name",
        placeholder: "Authorization",
        optional: true,
      },
      {
        name: "authValue",
        label: "Credential",
        type: "password",
        placeholder: "Bearer your-api-key",
      },
    ],
    hint: "Architecta POSTs JSON to this URL with your credential in the chosen header. Saving sends a { \"action\": \"connection.test\" } request first — your endpoint must answer 2xx.",
  },
  brevo: {
    fields: [
      {
        name: "senderEmail",
        label: "Send from",
        placeholder: "hello@yourdomain.com",
        optional: true,
      },
      {
        name: "apiKey",
        label: "API key",
        type: "password",
        placeholder: "Leave blank to use the configured key",
        optional: true,
      },
    ],
    hint: "The sender must already be verified in Brevo under Senders. Leave both blank to use the account Architecta is configured with.",
  },
};

function emptyForm(destination: string): Record<string, string> {
  return Object.fromEntries(
    (CONNECT_FIELDS[destination]?.fields ?? []).map((f) => [f.name, ""])
  );
}

export function BlogEmailConnections() {
  const { toast } = useToast();
  const [destinations, setDestinations] = useState<DestinationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ destinations: DestinationEntry[] }>;
      if (!json.ok) {
        setError(json.error.message);
      } else {
        setDestinations(json.data.destinations);
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

  // Surface the OAuth callback result (?destination=gmail&result=connected|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = params.get("destination");
    const result = params.get("result");
    if (!destination || !result) return;

    const label = DESTINATION_LABELS[destination] ?? destination;
    if (result === "connected") {
      toast({
        title: `${label} connected`,
        description: "Content is drafted for you to review — nothing sends automatically.",
      });
    } else {
      toast({
        title: `Couldn't connect ${label}`,
        description: "The authorization didn't complete. Please try again.",
        variant: "destructive",
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("destination");
    url.searchParams.delete("result");
    window.history.replaceState({}, "", url.toString());
  }, [toast]);

  async function connectCredentials(destination: string, label: string) {
    setBusy(destination);
    setFormError(null);
    try {
      // Drop untouched optional fields so the backend applies its defaults.
      const body = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value.trim() !== "")
      );
      const res = await fetch(`/api/integrations/${destination}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<{ externalAccountName: string | null }>;
      if (!json.ok) {
        setFormError(json.error.message);
        return;
      }
      // Clear the secret out of component state immediately.
      setForm({});
      setOpenForm(null);
      toast({
        title: `${label} connected`,
        description: "New content is created as a draft for you to review.",
      });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection(destination: string, label: string) {
    setBusy(destination);
    try {
      const res = await fetch(`/api/integrations/${destination}/test`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ ok: boolean; detail: string }>;
      if (!json.ok) {
        toast({ title: `${label} test failed`, description: json.error.message, variant: "destructive" });
        return;
      }
      toast({
        title: json.data.ok ? `${label} is working` : `${label} needs attention`,
        description: json.data.detail,
        variant: json.data.ok ? undefined : "destructive",
      });
      await load();
    } catch (err) {
      toast({
        title: `${label} test failed`,
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(destination: string, label: string) {
    setBusy(destination);
    try {
      const res = await fetch(`/api/integrations/${destination}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ disconnected: boolean }>;
      if (!json.ok) {
        toast({ title: "Disconnect failed", description: json.error.message, variant: "destructive" });
        return;
      }
      toast({ title: `${label} disconnected` });
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

  function describe(entry: DestinationEntry) {
    const connection = entry.connection;
    if (connection && connection.status === "connected") {
      // Whichever locator this destination stores: site, endpoint, or sender.
      const where = (
        connection.config.siteUrl ??
        connection.config.webhookUrl ??
        connection.config.senderEmail ??
        ""
      ).replace(/^https?:\/\//, "");
      if (where) {
        return `Connected to ${where}${
          connection.externalAccountName ? ` as ${connection.externalAccountName}` : ""
        }`;
      }
      return connection.externalAccountName
        ? `Connected as ${connection.externalAccountName}`
        : "Connected";
    }
    if (connection) return `Needs reconnect (${connection.status})`;
    if (!entry.implemented) return "Coming soon";
    return "Not connected";
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-background" />
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
      {destinations.map((entry) => {
        const Icon = DESTINATION_ICONS[entry.destination] ?? Globe;
        const connected = entry.connection?.status === "connected";
        const detail = describe(entry);
        const spec = CONNECT_FIELDS[entry.destination];
        const required = (spec?.fields ?? []).filter((f) => !f.optional);
        const canSubmit = required.every((f) => (form[f.name] ?? "").trim() !== "");

        return (
          <div
            key={entry.destination}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{entry.label}</p>
                  {connected ? (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-3 w-3" />
                      {detail}
                    </p>
                  ) : entry.connection ? (
                    <p className="text-xs text-amber-600">{detail}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {connected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testConnection(entry.destination, entry.label)}
                    disabled={busy === entry.destination}
                  >
                    Test
                  </Button>
                )}
                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => disconnect(entry.destination, entry.label)}
                    disabled={busy === entry.destination}
                  >
                    {busy === entry.destination ? (
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
                    onClick={() => {
                      if (entry.connectMethod === "oauth") {
                        // Full-page navigation: /start redirects to the provider.
                        window.location.href = `/api/integrations/${entry.destination}/start`;
                        return;
                      }
                      setFormError(null);
                      const next = openForm === entry.destination ? null : entry.destination;
                      setOpenForm(next);
                      setForm(next ? emptyForm(next) : {});
                    }}
                    disabled={!entry.implemented}
                  >
                    <Plug className="h-4 w-4" />
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {openForm === entry.destination && spec && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {spec.fields.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {field.label}
                      {field.optional && " (optional)"}
                    </label>
                    <Input
                      type={field.type ?? "text"}
                      value={form[field.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      autoComplete={field.type === "password" ? "new-password" : "off"}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{spec.hint}</p>
                {formError && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                    {formError}
                  </p>
                )}
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => connectCredentials(entry.destination, entry.label)}
                  disabled={busy === entry.destination || !canSubmit}
                >
                  {busy === entry.destination ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4" />
                  )}
                  Connect {entry.label}
                </Button>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Architecta creates drafts in your own accounts. Nothing is published or sent until you
        approve it.
      </p>
    </div>
  );
}
