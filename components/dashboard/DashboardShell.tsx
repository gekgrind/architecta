"use client";

import { ArchitectaDashboard } from "@/components/dashboard/ArchitectaDashboard";
import { useAuthIdentity } from "@/hooks/use-auth-identity";

export function DashboardShell() {
  const { avatarUrl, displayName, loading, title, user, workspaceName } =
    useAuthIdentity();
  const resolvedName = loading ? "Founder" : displayName;
  const resolvedTitle = loading ? "Founder" : title;

  return (
    <ArchitectaDashboard
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
