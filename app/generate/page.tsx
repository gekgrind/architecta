"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { GenerateStudio } from "@/components/generate/generate-studio"

export default function GeneratePage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Generate" }]}>
      <GenerateStudio />
    </DashboardLayout>
  )
}
