"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { EmptyState } from "@/components/ui/empty-state"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Analytics" }]}>
      <EmptyState
        icon={BarChart3}
        title="Coming Soon"
        description="Analytics and performance tracking will be available in the next update. Track engagement, reach, and ROI across all your content."
      />
    </DashboardLayout>
  )
}
