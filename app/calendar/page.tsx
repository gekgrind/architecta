"use client";

import { CalendarShell } from "@/components/calendar/calendar-shell";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function CalendarPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Calendar" }]}>
      <CalendarShell />
    </DashboardLayout>
  );
}
