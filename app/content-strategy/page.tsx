"use client";

import { ContentStrategyStudio } from "@/components/content-strategy/content-strategy-studio";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function ContentStrategyPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Content Strategy" }]}>
      <ContentStrategyStudio />
    </DashboardLayout>
  );
}
