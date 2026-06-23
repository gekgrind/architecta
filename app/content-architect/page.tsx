"use client";

import { ContentArchitectStudio } from "@/components/content-architect/content-architect-studio";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function ContentArchitectPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Content Architect" }]}>
      <ContentArchitectStudio />
    </DashboardLayout>
  );
}
