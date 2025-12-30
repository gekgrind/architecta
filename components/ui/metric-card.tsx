"use client";

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    direction: "up" | "down" | "neutral"
  }
  className?: string
}

export function MetricCard({ label, value, trend, className }: MetricCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {trend && (
            <span
              className={cn(
                "flex items-center text-xs font-medium mb-1",
                trend.direction === "up" && "text-emerald-600",
                trend.direction === "down" && "text-red-600",
                trend.direction === "neutral" && "text-muted-foreground",
              )}
            >
              {trend.direction === "up" && <TrendingUp className="h-3 w-3 mr-0.5" />}
              {trend.direction === "down" && <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trend.direction === "neutral" && <Minus className="h-3 w-3 mr-0.5" />}
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
