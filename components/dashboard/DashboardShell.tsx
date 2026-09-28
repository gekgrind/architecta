"use client";

import { ArchitectaDashboard } from "@/components/dashboard/ArchitectaDashboard";
import { useAuthIdentity } from "@/hooks/use-auth-identity";
import type { DashboardResult } from "@/lib/dashboard/model";

export function DashboardShell({ dashboard }: { dashboard: DashboardResult }) {
  const { avatarUrl, displayName, loading, title, user, workspaceName } =
    useAuthIdentity();
  const resolvedName = loading ? "Founder" : displayName;
  const resolvedTitle = loading ? "Founder" : title;

  return (
    <ArchitectaDashboard
      dashboard={dashboard}
      identity={{
        avatarUrl,
        displayName: resolvedName,
        email: user?.email ?? null,
        title: resolvedTitle,
        workspaceName: workspaceName ?? "Owner & Architect",
      }}
    />
  );
}
