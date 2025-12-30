"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { EmptyState } from "@/components/ui/empty-state"
import { Target } from "lucide-react"

export default function CampaignsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Campaigns" }]}>
      <EmptyState
        icon={Target}
        title="Coming Soon"
        description="Campaign management will be available in the next update. Create and organize your content into powerful marketing campaigns."
      />
    </DashboardLayout>
  )
}
