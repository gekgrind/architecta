"use client";

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ContentStatus, ContentType } from "@/lib/types"
import { X } from "lucide-react"

interface Filters {
  status: ContentStatus[]
  contentType: ContentType[]
  campaign: string
  tags: string[]
}

interface FilterSidebarProps {
  open: boolean
  onClose: () => void
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  onClear: () => void
}

const statusOptions: { value: ContentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

const contentTypeOptions: { value: ContentType; label: string }[] = [
  { value: "tweet", label: "Tweet" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
  { value: "ad", label: "Ad Copy" },
]

const campaignOptions = ["Q4 Launch Campaign", "Thought Leadership", "Onboarding Sequence", "Product Launch"]

const tagOptions = ["productivity", "automation", "leadership", "saas", "planning", "remote"]

export function FilterSidebar({ open, onClose, filters, onFiltersChange, onClear }: FilterSidebarProps) {
  const toggleStatus = (status: ContentStatus) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]
    onFiltersChange({ ...filters, status: newStatus })
  }

  const toggleContentType = (type: ContentType) => {
    const newTypes = filters.contentType.includes(type)
      ? filters.contentType.filter((t) => t !== type)
      : [...filters.contentType, type]
    onFiltersChange({ ...filters, contentType: newTypes })
  }

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag]
    onFiltersChange({ ...filters, tags: newTags })
  }

  const hasActiveFilters =
    filters.status.length > 0 || filters.contentType.length > 0 || filters.campaign || filters.tags.length > 0

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-80">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Filters</SheetTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
              Clear All
            </Button>
          )}
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status */}
          <div className="space-y-3">
            <Label>Status</Label>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={filters.status.includes(option.value)}
                    onCheckedChange={() => toggleStatus(option.value)}
                  />
                  <label htmlFor={`status-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Content Type */}
          <div className="space-y-3">
            <Label>Content Type</Label>
            <div className="space-y-2">
              {contentTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`type-${option.value}`}
                    checked={filters.contentType.includes(option.value)}
                    onCheckedChange={() => toggleContentType(option.value)}
                  />
                  <label htmlFor={`type-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign */}
          <div className="space-y-3">
            <Label>Campaign</Label>
            <Select
              value={filters.campaign}
              onValueChange={(value) => onFiltersChange({ ...filters, campaign: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaignOptions.map((campaign) => (
                  <SelectItem key={campaign} value={campaign}>
                    {campaign}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <Badge
                  key={tag}
                  variant={filters.tags.includes(tag) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    filters.tags.includes(tag) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {filters.tags.includes(tag) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <div className="absolute bottom-6 left-6 right-6">
          <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90">
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
