"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { BrandKitWizard } from "@/components/brand-kit/brand-kit-wizard"

export default function BrandKitPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Brand Kit" }]}>
      <div className="max-w-3xl mx-auto">
        <BrandKitWizard />
      </div>
    </DashboardLayout>
  )
}
