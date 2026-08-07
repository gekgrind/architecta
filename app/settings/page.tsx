"use client";

import Link from "next/link";
import { Building2, Newspaper, Settings, Share2, User } from "lucide-react";

import { AiProviderSettings } from "@/components/settings/AiProviderSettings";
import { BlogEmailConnections } from "@/components/settings/BlogEmailConnections";
import { PlatformConnections } from "@/components/settings/PlatformConnections";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useAuthIdentity } from "@/hooks/use-auth-identity";
import { buildSharedLoginHref } from "@/lib/auth/redirects";

export default function SettingsPage() {
  const { error, isAuthenticated, loading, displayName, user, workspaceName } =
    useAuthIdentity();

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: "Settings" }]}>
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !isAuthenticated) {
    return (
      <DashboardLayout breadcrumbs={[{ label: "Settings" }]}>
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Account unavailable
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in again to manage your Architecta settings.
              </p>
            </div>
          </div>
          {error && (
            <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button asChild>
            <Link href={buildSharedLoginHref("/settings")}>Sign in</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: "Settings" }]}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Account</h1>
              <p className="text-sm text-muted-foreground">
                Review the shared Entrepreneuria identity used by Architecta.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {displayName}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {user?.email ?? "Not available"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Workspace</h2>
              <p className="text-sm text-muted-foreground">
                Workspace access is managed through your shared Entrepreneuria account.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current workspace
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {workspaceName ?? "Entrepreneuria"}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Generation preferences
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure the AI behavior used by Architecta workflows.
              </p>
            </div>
          </div>

          <AiProviderSettings />
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Connected accounts
              </h2>
              <p className="text-sm text-muted-foreground">
                Link social platforms to publish and schedule posts directly.
              </p>
            </div>
          </div>

          <PlatformConnections />
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Newspaper className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Blog &amp; Email
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect your own blog and email tools to draft content directly into them.
              </p>
            </div>
          </div>

          <BlogEmailConnections />
        </section>
      </div>
    </DashboardLayout>
  );
}
