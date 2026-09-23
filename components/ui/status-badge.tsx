"use client";

import { cn } from "@/lib/utils"
import type { ContentStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: ContentStatus
  className?: string
}

const statusConfig: Record<ContentStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-700",
  },
  publishing: {
    label: "Publishing",
    className: "bg-blue-100 text-blue-700",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
  published: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-700",
  },
  archived: {
    label: "Archived",
    className: "bg-orange-100 text-orange-700",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
