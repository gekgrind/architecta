"use client";

import type React from "react"

import { BlueprintBackground } from "@/components/dashboard/BlueprintBackground"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface DashboardLayoutProps {
  children: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export function DashboardLayout({ children, breadcrumbs }: DashboardLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#041C3B]">
      <BlueprintBackground />
      <Sidebar />
      <div className="relative z-10 lg:pl-60">
        <Header breadcrumbs={breadcrumbs} />
        <main className="p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
