"use client";

import { AnalyticsShell } from "@/components/analytics/analytics-shell";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function AnalyticsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Analytics" }]}>
      <AnalyticsShell />
    </DashboardLayout>
  );
}
