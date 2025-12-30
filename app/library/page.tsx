"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentLibrary } from "@/components/library/content-library"

export default function LibraryPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Library" }]}>
      <ContentLibrary />
    </DashboardLayout>
  )
}
