"use client";

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContentGrid } from "./content-grid"
import { ContentList } from "./content-list"
import { FilterSidebar } from "./filter-sidebar"
import { mockContentItems } from "@/lib/mock-data"
import type { ContentStatus, ContentType } from "@/lib/types"
import { Search, Filter, ArrowUpDown, LayoutGrid, List, Plus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

export function ContentLibrary() {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "a-z" | "z-a">("newest")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(initialFilters)

  // Filter and sort content
  let filteredContent = [...mockContentItems]

  // Apply search
  if (searchQuery) {
    filteredContent = filteredContent.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }

  // Apply filters
  if (filters.status.length > 0) {
    filteredContent = filteredContent.filter((item) => filters.status.includes(item.status))
  }
  if (filters.contentType.length > 0) {
    filteredContent = filteredContent.filter((item) => filters.contentType.includes(item.contentType))
  }
  if (filters.campaign) {
    filteredContent = filteredContent.filter((item) => item.campaign === filters.campaign)
  }
  if (filters.tags.length > 0) {
    filteredContent = filteredContent.filter((item) => filters.tags.some((tag) => item.tags?.includes(tag)))
  }

  // Apply sort
  filteredContent.sort((a, b) => {
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

  const activeFiltersCount =
    filters.status.length + filters.contentType.length + (filters.campaign ? 1 : 0) + filters.tags.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Content Library
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredContent.length} items
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>

          {/* Filter */}
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

          {/* Sort */}
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

          {/* View Toggle */}
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

          {/* New Content */}
          <Link href="/generate">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Content</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {filteredContent.length === 0 ? (
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

      {/* Filter Sidebar */}
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
