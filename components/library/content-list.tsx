"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/ui/status-badge"
import { ContentTypeIcon } from "@/components/ui/content-type-icon"
import type { ContentItem } from "@/lib/types"
import {
  MoreHorizontal,
  Edit,
  Copy,
  Share2,
  Trash2,
  BarChart2,
  Film,
  ImageIcon,
  Layers,
} from "lucide-react"

interface ContentListProps {
  items: ContentItem[]
}

const contentTypeLabels: Record<string, string> = {
  tweet: "Tweet",
  linkedin: "LinkedIn",
  blog: "Blog",
  email: "Email",
  ad: "Ad Copy",
}

function MediaThumbSmall({ item }: { item: ContentItem }) {
  const media = item.media
  if (!media) return null
  const Icon =
    media.kind === "image" ? ImageIcon : media.kind === "video" ? Film : Layers
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {media.kind === "image" && media.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.imageUrl}
          alt={media.label ?? "Generated image"}
          className="h-full w-full object-cover"
        />
      ) : media.kind === "video" && media.videoUrl ? (
        <video
          src={media.videoUrl}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  )
}

export function ContentList({ items }: ContentListProps) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Content</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <MediaThumbSmall item={item} />
                  <ContentTypeIcon type={item.contentType} size={16} />
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">{item.content}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{contentTypeLabels[item.contentType]}</TableCell>
              <TableCell className="text-muted-foreground">{item.campaign || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                {item.performanceData ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <BarChart2 className="h-4 w-4" />
                    {item.performanceData.engagements}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
