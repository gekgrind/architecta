"use client";

import { CampaignsShell } from "@/components/campaigns/campaigns-shell";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function CampaignsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Campaigns" }]}>
      <CampaignsShell />
    </DashboardLayout>
  );
}
