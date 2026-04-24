"use client";

import { motion } from "framer-motion";

interface ContentItemProps {
  id: string;
  title: string;
  type: string;
  status: "published" | "scheduled" | "draft";
  date: string;
  engagement: number | null;
  index: number;
}

export default function ContentItem({
  title,
  type,
  status,
  date,
  engagement,
  index,
}: ContentItemProps) {
  const statusConfig = {
    published: {
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    scheduled: {
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    draft: {
      color: "text-gray-400",
      bgColor: "bg-gray-500/10",
      borderColor: "border-gray-500/30",
    },
  };

  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="group px-6 py-4 hover:bg-blueprint-cyan/5 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title & Type */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate group-hover:text-blueprint-cyan transition-colors">
            {title}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">{type}</p>
        </div>

        {/* Center: Status */}
        <div
          className={`px-3 py-1 rounded-full border ${config.bgColor} ${config.borderColor}`}
        >
          <span className={`text-xs font-mono uppercase tracking-wider ${config.color}`}>
            {status}
          </span>
        </div>

        {/* Right: Date & Engagement */}
        <div className="text-right min-w-[120px]">
          <p className="text-xs text-muted-foreground">{date}</p>
          {engagement !== null && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <svg
                className="w-3 h-3 text-blueprint-cyan"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span className="text-xs font-medium text-blueprint-cyan">
                {engagement}%
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
