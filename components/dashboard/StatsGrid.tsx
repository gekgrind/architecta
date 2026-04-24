"use client";

import StatCard from "@/components/cards/StatCard";
import { Icons } from "@/components/icons";

const stats = [
  {
    title: "Total Content",
    value: "247",
    trend: "up" as const,
    trendValue: "+12%",
    icon: Icons.Document,
  },
  {
    title: "Published",
    value: "183",
    trend: "up" as const,
    trendValue: "+8%",
    icon: Icons.Check,
  },
  {
    title: "Engagement Rate",
    value: "4.8%",
    trend: "up" as const,
    trendValue: "+0.6%",
    icon: Icons.TrendUp,
  },
  {
    title: "Content Score",
    value: "92",
    trend: "up" as const,
    trendValue: "+3",
    icon: Icons.Star,
  },
];

export default function StatsGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat, index) => (
        <StatCard key={stat.title} {...stat} index={index} />
      ))}
    </section>
  );
}
