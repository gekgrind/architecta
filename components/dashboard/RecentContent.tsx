"use client";

import ContentItem from "@/components/cards/ContentItem";
import { Icons } from "@/components/icons";

const recentContent = [
  {
    id: "1",
    title: "10 AI Tools Every Entrepreneur Needs in 2025",
    type: "Blog Post",
    status: "published" as const,
    date: "2 hours ago",
    engagement: 6.2,
  },
  {
    id: "2",
    title: "Weekly LinkedIn Growth Strategy Thread",
    type: "Social Post",
    status: "scheduled" as const,
    date: "Tomorrow, 9:00 AM",
    engagement: null,
  },
  {
    id: "3",
    title: "Product Launch Announcement Email",
    type: "Email",
    status: "draft" as const,
    date: "Dec 28, 2024",
    engagement: null,
  },
];

export default function RecentContent() {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-mono uppercase tracking-[0.3em] text-blueprint-cyan/80">
            Recent Content
          </h3>
          <div className="w-40 h-px bg-gradient-to-r from-blueprint-cyan/40 to-transparent" />
        </div>

        <button className="text-xs font-mono uppercase tracking-widest
          text-blueprint-cyan hover:text-blueprint-cyan/80
          flex items-center gap-2">
          View All
          <Icons.Arrow className="w-4 h-4" />
        </button>
      </div>

      <div
        className="relative rounded-lg overflow-hidden
          bg-blueprint-panel/70 backdrop-blur-md
          border border-blueprint-cyan/25"
      >
        <div className="divide-y divide-blueprint-cyan/10">
          {recentContent.map((item, index) => (
            <ContentItem key={item.id} {...item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
