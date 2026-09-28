import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { buildSharedLoginHref } from "@/lib/auth/redirects";
import { loadDashboard } from "@/lib/dashboard/load";

export default async function DashboardPage() {
  const dashboard = await loadDashboard();

  if (dashboard.status === "unauthenticated") {
    redirect(buildSharedLoginHref("/dashboard"));
  }

  return <DashboardShell dashboard={dashboard} />;
}
