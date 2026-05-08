"use client";

import { ArchitectaDashboard } from "@/components/dashboard/ArchitectaDashboard";
import { useAuthIdentity } from "@/hooks/use-auth-identity";

export function DashboardShell() {
  const { avatarUrl, displayName, loading, workspaceName } = useAuthIdentity();
  const resolvedName = loading ? "Founder" : displayName;

  return (
    <ArchitectaDashboard
      identity={{
        avatarUrl,
        displayName: resolvedName,
        workspaceName: workspaceName ?? "Owner & Architect",
      }}
    />
  );
}
