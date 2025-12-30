"use client";

import { cn } from "@/lib/utils"

interface CharacterCounterProps {
  current: number
  max: number
  className?: string
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const percentage = (current / max) * 100
  const isWarning = percentage >= 80 && percentage < 100
  const isOver = percentage >= 100

  return (
    <span
      className={cn(
        "text-xs font-medium",
        !isWarning && !isOver && "text-muted-foreground",
        isWarning && "text-amber-600",
        isOver && "text-red-600",
        className,
      )}
    >
      {current}/{max}
    </span>
  )
}
