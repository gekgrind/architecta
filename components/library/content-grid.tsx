"use client";

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { ContentTypeIcon } from "@/components/ui/content-type-icon"
import type { ContentItem } from "@/lib/types"
import { Calendar, BarChart2, Edit, Copy, Trash2, Share2 } from "lucide-react"

interface ContentGridProps {
  items: ContentItem[]
}

export function ContentGrid({ items }: ContentGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ContentCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <ContentTypeIcon type={item.contentType} size={20} />
          <StatusBadge status={item.status} />
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{item.title}</h3>

        {/* Content Preview */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{item.content}</p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(item.createdAt).toLocaleDateString()}
          </div>
          {item.performanceData && (
            <div className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              {item.performanceData.engagements}
            </div>
          )}
        </div>

        {item.campaign && (
          <div className="mt-2">
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{item.campaign}</span>
          </div>
        )}
      </CardContent>

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
