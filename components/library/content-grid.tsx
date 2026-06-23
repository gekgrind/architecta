"use client";

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { ContentTypeIcon } from "@/components/ui/content-type-icon"
import type { ContentItem } from "@/lib/types"
import {
  Calendar,
  BarChart2,
  Edit,
  Copy,
  Trash2,
  Share2,
  Film,
  ImageIcon,
  Layers,
} from "lucide-react"

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

function MediaThumb({ media }: { media: NonNullable<ContentItem["media"]> }) {
  if (media.kind === "image" && media.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.imageUrl}
        alt={media.label ?? "Generated image"}
        className="h-full w-full object-cover"
      />
    )
  }
  if (media.kind === "video" && media.videoUrl) {
    return (
      <video
        src={media.videoUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }
  // Storyboard or missing URL placeholder.
  const Icon = media.kind === "video" ? Film : media.kind === "storyboard" ? Layers : ImageIcon
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
  )
}

function MediaBadge({ media }: { media: NonNullable<ContentItem["media"]> }) {
  const Icon =
    media.kind === "image" ? ImageIcon : media.kind === "video" ? Film : Layers
  return (
    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground backdrop-blur">
      <Icon className="h-3 w-3" />
      {media.kind === "storyboard" ? "Storyboard" : media.kind}
    </span>
  )
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {item.media && (
        <div className="relative aspect-video w-full overflow-hidden border-b border-border bg-muted">
          <MediaThumb media={item.media} />
          <MediaBadge media={item.media} />
        </div>
      )}
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
