"use client";

import { useState } from "react";
import BlueprintBackground from "@/components/blueprint/BlueprintBackground";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import StatsGrid from "@/components/dashboard/StatsGrid";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentContent from "@/components/dashboard/RecentContent";

export default function ArchitectaDashboard() {
  const [theme] = useState<"dark" | "light">("dark");
  const [activeNav, setActiveNav] = useState("Dashboard");

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-blueprint-navy text-white" : "bg-white text-slate-900"}`}>
      <BlueprintBackground theme={theme} />

      <div className="flex">
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
        <main className="flex-1 ml-72">
          <Header />
          <StatsGrid />
          <QuickActions />
          <RecentContent />
        </main>
      </div>
    </div>
  );
}
