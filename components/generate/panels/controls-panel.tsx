"use client";

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GenerationUIConfig, ContentType, StructureHint, } from "@/lib/types"
import { contentStructures } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  Twitter,
  Linkedin,
  FileText,
  Mail,
  Megaphone,
  Sparkles,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react"

interface ControlsPanelProps {
  config: GenerationUIConfig;
  updateConfig: (data: Partial<GenerationUIConfig>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const contentTypes: { type: ContentType; label: string; icon: React.ElementType }[] = [
  { type: "tweet", label: "Tweet", icon: Twitter },
  { type: "linkedin_post", label: "LinkedIn", icon: Linkedin },
  { type: "blog_post", label: "Blog", icon: FileText },
  { type: "email", label: "Email", icon: Mail },
  { type: "ad_copy", label: "Ad Copy", icon: Megaphone },
]

export function ControlsPanel({ config, updateConfig, onGenerate, isGenerating }: ControlsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [keywordInput, setKeywordInput] = useState("")

  const addKeyPoint = () => {
    updateConfig({ keyPoints: [...config.keyPoints, ""] })
  }

  const removeKeyPoint = (index: number) => {
    const newPoints = config.keyPoints.filter((_, i) => i !== index)
    updateConfig({ keyPoints: newPoints.length ? newPoints : [""] })
  }

  const updateKeyPoint = (index: number, value: string) => {
    const newPoints = [...config.keyPoints]
    newPoints[index] = value
    updateConfig({ keyPoints: newPoints })
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !config.keywords.includes(keywordInput.trim())) {
      updateConfig({ keywords: [...config.keywords, keywordInput.trim()] })
      setKeywordInput("")
    }
  }

  const removeKeyword = (keyword: string) => {
    updateConfig({ keywords: config.keywords.filter((k) => k !== keyword) })
  }

  const getToneLabel = (value: number) => {
    if (value < 25) return "Professional"
    if (value < 50) return "Semi-formal"
    if (value < 75) return "Conversational"
    return "Casual"
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-6 pb-4">
          {/* Content Type */}
          <div className="space-y-3">
            <Label>Content Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {contentTypes.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateConfig({ contentType: type })}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200",
                    config.contentType === type
                      ? "border-secondary bg-secondary text-secondary-foreground"
                      : "border-border bg-card hover:border-muted-foreground/50",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Textarea
              id="topic"
              placeholder="What do you want to create content about?"
              value={config.topic}
              onChange={(e) => updateConfig({ topic: e.target.value })}
              className="min-h-[80px] resize-none"
            />
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
              <Sparkles className="h-3 w-3" />
              Get AI topic ideas
            </Button>
          </div>

          {/* Key Points */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <Label>Key Points</Label>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2">
                {config.keyPoints.map((point, index) => (
                  <div key={index} className="flex gap-2">
                    <GripVertical className="h-4 w-4 mt-3 text-muted-foreground cursor-grab" />
                    <Input
                      placeholder={`Key point ${index + 1}`}
                      value={point}
                      onChange={(e) => updateKeyPoint(index, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeKeyPoint(index)}
                      disabled={config.keyPoints.length === 1}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addKeyPoint} className="text-muted-foreground">
                  <Plus className="mr-1 h-4 w-4" />
                  Add key point
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Tone Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tone</Label>
              <span className="text-sm font-medium text-secondary">{getToneLabel(config.tone)}</span>
            </div>
            <div className="px-1">
              <Slider
                value={[config.tone]}
                onValueChange={([value]) => updateConfig({ tone: value })}
                max={100}
                step={1}
                className="[&>span:first-child]:bg-gradient-to-r [&>span:first-child]:from-primary [&>span:first-child]:to-secondary"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">Professional</span>
                <span className="text-xs text-muted-foreground">Casual</span>
              </div>
            </div>
          </div>

          {/* Length */}
          <div className="space-y-3">
            <Label>Length</Label>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(["short", "medium", "long"] as const).map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => updateConfig({ length })}
                  className={cn(
                    "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200",
                    config.length === length
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {length.charAt(0).toUpperCase() + length.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {config.length === "short" && "50-150 words"}
              {config.length === "medium" && "150-400 words"}
              {config.length === "long" && "400+ words"}
            </p>
          </div>

          {/* Structure */}
          <div className="space-y-2">
            <Label>Structure</Label>
            <Select value={config.structure} onValueChange={(value) => updateConfig({ structure: value as StructureHint })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentStructures.map((structure) => (
                  <SelectItem key={structure.value} value={structure.value}>
                    {structure.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Options */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground">
              Advanced Options
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", advancedOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {/* Keywords */}
              <div className="space-y-2">
                <Label>Target Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a keyword..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  />
                  <Button type="button" variant="outline" onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {config.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {config.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                        <button onClick={() => removeKeyword(keyword)} className="ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cta-toggle">Include Call to Action</Label>
                  <Switch
                    id="cta-toggle"
                    checked={config.includeCTA}
                    onCheckedChange={(checked) => updateConfig({ includeCTA: checked })}
                  />
                </div>
                {config.includeCTA && (
                  <Input
                    placeholder="e.g., Click the link in bio to learn more"
                    value={config.ctaText}
                    onChange={(e) => updateConfig({ ctaText: e.target.value })}
                  />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Generate Button */}
      <div className="pt-4 border-t border-border">
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !config.topic.trim()}
          className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Content
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
