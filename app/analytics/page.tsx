"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { EmptyState } from "@/components/ui/empty-state"
import type { AnalyticsSummary } from "@/lib/domain"
import { BarChart3 } from "lucide-react"

const placeholderAnalytics: AnalyticsSummary = {
  workspaceId: null,
  totals: {
    engagements: 0,
    clicks: 0,
    impressions: 0,
  },
  topContentIds: [],
}

export default function AnalyticsPage() {
  void placeholderAnalytics

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
