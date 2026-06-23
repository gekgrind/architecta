"use client";

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContentGrid } from "./content-grid"
import { ContentList } from "./content-list"
import { FilterSidebar } from "./filter-sidebar"
import type { ContentItem, ContentMedia, ContentStatus, ContentType } from "@/lib/types"
import { Search, Filter, ArrowUpDown, LayoutGrid, List, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Filters {
  status: ContentStatus[]
  contentType: ContentType[]
  campaign: string
  tags: string[]
}

const initialFilters: Filters = {
  status: [],
  contentType: [],
  campaign: "",
  tags: [],
}

const PLATFORM_TO_CONTENT_TYPE: Record<string, ContentType> = {
  linkedin: "linkedin",
  x: "tweet",
  twitter: "tweet",
  blog: "blog",
  email: "email",
  facebook: "linkedin",
  instagram: "linkedin",
  tiktok: "linkedin",
  pinterest: "linkedin",
  youtube: "blog",
  newsletter: "email",
  threads: "tweet",
}

const POST_STATUS_TO_CONTENT_STATUS: Record<string, ContentStatus> = {
  idea: "draft",
  draft: "draft",
  approved: "draft",
  scheduled: "scheduled",
  published: "published",
  archived: "archived",
}

type ApiPost = {
  id: string
  platform: string
  title: string | null
  hook: string | null
  caption: string | null
  body: string | null
  hashtags: string[]
  cta: string | null
  status: string
  createdAt: string
  publishedAt: string | null
  campaignId: string | null
}

type ApiAsset = {
  id: string
  postId: string | null
  assetType: "image" | "video"
  signedUrl: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  meta: Record<string, unknown> | null
  createdAt: string
}

function assetToMedia(asset: ApiAsset | undefined): ContentMedia | undefined {
  if (!asset) return undefined
  if (asset.assetType === "image") {
    return {
      kind: "image",
      imageUrl: asset.signedUrl ?? undefined,
      label:
        asset.width && asset.height
          ? `${asset.width}×${asset.height}`
          : "Image",
    }
  }
  const status =
    (asset.meta &&
      typeof asset.meta === "object" &&
      typeof (asset.meta as { status?: unknown }).status === "string"
      ? (asset.meta as { status: string }).status
      : "ready")
  if (status === "storyboard") {
    return {
      kind: "storyboard",
      label: asset.durationSeconds ? `~${asset.durationSeconds}s storyboard` : "Storyboard",
    }
  }
  return {
    kind: "video",
    videoUrl: asset.signedUrl ?? undefined,
    label: asset.durationSeconds ? `${asset.durationSeconds}s video` : "Video",
  }
}

function pickPrimaryAsset(assets: ApiAsset[]): ApiAsset | undefined {
  if (assets.length === 0) return undefined
  // Prefer image, then ready video, then storyboard.
  const image = assets.find((a) => a.assetType === "image")
  if (image) return image
  const readyVideo = assets.find(
    (a) =>
      a.assetType === "video" &&
      (((a.meta as { status?: string } | null)?.status ?? "ready") !== "storyboard")
  )
  if (readyVideo) return readyVideo
  return assets[0]
}

function postToContentItem(post: ApiPost, media?: ContentMedia): ContentItem {
  const contentType = PLATFORM_TO_CONTENT_TYPE[post.platform] ?? "linkedin"
  const status = POST_STATUS_TO_CONTENT_STATUS[post.status] ?? "draft"
  const body = [post.hook, post.caption || post.body, post.cta]
    .filter(Boolean)
    .join("\n\n")

  return {
    id: post.id,
    contentType,
    status,
    title: post.title?.trim() ? post.title : "Untitled post",
    content: body,
    cta: post.cta ?? undefined,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt ?? undefined,
    campaign: post.campaignId ?? undefined,
    tags: post.hashtags?.length ? post.hashtags : undefined,
    media,
  }
}

export function ContentLibrary() {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "a-z" | "z-a">("newest")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [postsRes, assetsRes] = await Promise.all([
          fetch("/api/posts"),
          fetch("/api/assets"),
        ])

        const postsJson = (await postsRes.json().catch(() => null)) as
          | { ok?: boolean; data?: { posts: ApiPost[] }; error?: { message?: string } }
          | null

        if (!postsRes.ok || !postsJson?.ok || !postsJson.data?.posts) {
          throw new Error(postsJson?.error?.message ?? `Library load failed (${postsRes.status})`)
        }

        const assetsJson = (await assetsRes.json().catch(() => null)) as
          | { ok?: boolean; data?: { assets: ApiAsset[] } }
          | null

        const byPost = new Map<string, ApiAsset[]>()
        if (assetsJson?.ok && assetsJson.data?.assets) {
          for (const asset of assetsJson.data.assets) {
            if (!asset.postId) continue
            const bucket = byPost.get(asset.postId) ?? []
            bucket.push(asset)
            byPost.set(asset.postId, bucket)
          }
        }

        if (!cancelled) {
          setItems(
            postsJson.data.posts.map((post) =>
              postToContentItem(post, assetToMedia(pickPrimaryAsset(byPost.get(post.id) ?? [])))
            )
          )
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Library load failed"
          setError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredContent = useMemo(() => {
    let next = [...items]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      next = next.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q)
      )
    }

    if (filters.status.length > 0) {
      next = next.filter((item) => filters.status.includes(item.status))
    }
    if (filters.contentType.length > 0) {
      next = next.filter((item) => filters.contentType.includes(item.contentType))
    }
    if (filters.campaign) {
      next = next.filter((item) => item.campaign === filters.campaign)
    }
    if (filters.tags.length > 0) {
      next = next.filter((item) =>
        filters.tags.some((tag) => item.tags?.includes(tag))
      )
    }

    next.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "a-z":
          return a.title.localeCompare(b.title)
        case "z-a":
          return b.title.localeCompare(a.title)
        default:
          return 0
      }
    })

    return next
  }, [items, searchQuery, sortBy, filters])

  const activeFiltersCount =
    filters.status.length +
    filters.contentType.length +
    (filters.campaign ? 1 : 0) +
    filters.tags.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Content Library
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {loading ? "…" : `${filteredContent.length} items`}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(true)}
            className={cn(activeFiltersCount > 0 && "border-primary text-primary")}
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("newest")}>Newest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("oldest")}>Oldest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("a-z")}>A-Z</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("z-a")}>Z-A</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex border border-border rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("grid")}
              className={cn("rounded-r-none", view === "grid" && "bg-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("list")}
              className={cn("rounded-l-none", view === "list" && "bg-muted")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Link href="/generate">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Content</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No content found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {searchQuery || activeFiltersCount > 0
              ? "Try adjusting your search or filters"
              : "Start by generating your first piece of content"}
          </p>
          {!searchQuery && activeFiltersCount === 0 && (
            <Link href="/generate">
              <Button className="bg-primary hover:bg-primary/90">Generate Content</Button>
            </Link>
          )}
        </div>
      ) : view === "grid" ? (
        <ContentGrid items={filteredContent} />
      ) : (
        <ContentList items={filteredContent} />
      )}

      <FilterSidebar
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onClear={() => setFilters(initialFilters)}
      />
    </div>
  )
}
