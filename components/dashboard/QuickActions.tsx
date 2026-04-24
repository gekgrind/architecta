"use client";

import QuickActionCard from "@/components/cards/QuickActionCard";
import { Icons } from "@/components/icons";

const actions = [
  {
    title: "Generate Content",
    description:
      "Create new content using AI-powered generation with your brand voice.",
    icon: Icons.Generate,
    gradient: "from-blueprint-cyan to-blue-600",
  },
  {
    title: "Brand Kit",
    description:
      "Manage your brand voice, tone, and style guidelines.",
    icon: Icons.BrandKit,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    title: "View Library",
    description:
      "Browse and manage all your created content in one place.",
    icon: Icons.Library,
    gradient: "from-emerald-500 to-teal-600",
  },
];

export default function QuickActions() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-mono uppercase tracking-[0.3em] text-blueprint-cyan/80">
          Quick Actions
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-blueprint-cyan/40 to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {actions.map((action, index) => (
          <QuickActionCard key={action.title} {...action} index={index} />
        ))}
      </div>
    </section>
  );
}
