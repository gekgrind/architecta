"use client";

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Bookmark,
  Copy,
  Download,
  Sparkles,
  ChevronDown,
  Lightbulb,
  Clock,
  Check,
  FileText,
  FileDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionsPanelProps {
  hasContent: boolean
  contentScore: number | null
  content: string
}

const suggestions = [
  { text: "Add a specific example or story", id: 1 },
  { text: "Include a relevant statistic", id: 2 },
  { text: "End with a stronger CTA", id: 3 },
]

const versions = [
  { id: 1, timestamp: "2 min ago", preview: "The secret to success..." },
  { id: 2, timestamp: "5 min ago", preview: "What I've learned about..." },
  { id: 3, timestamp: "10 min ago", preview: "Here's a framework for..." },
]

export function ActionsPanel({ hasContent, contentScore, content }: ActionsPanelProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600"
    if (score >= 60) return "text-amber-600"
    return "text-red-600"
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return "stroke-emerald-500"
    if (score >= 60) return "stroke-amber-500"
    return "stroke-red-500"
  }

  return (
    <div className="space-y-4">
      {/* Content Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted"
                />
                {contentScore !== null && (
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    strokeWidth="6"
                    strokeDasharray={`${(contentScore / 100) * 176} 176`}
                    strokeLinecap="round"
                    className={cn("transition-all duration-500", getScoreBg(contentScore))}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    "text-lg font-bold",
                    contentScore !== null ? getScoreColor(contentScore) : "text-muted-foreground",
                  )}
                >
                  {contentScore !== null ? contentScore : "--"}
                </span>
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground">Content Score</p>
              <p className="text-sm text-muted-foreground">
                {contentScore !== null
                  ? contentScore >= 80
                    ? "Great quality!"
                    : contentScore >= 60
                      ? "Good, room to improve"
                      : "Needs work"
                  : "Generate content first"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card className={cn(!hasContent && "opacity-50")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-secondary" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground flex-1">{suggestion.text}</span>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" disabled={!hasContent}>
                Apply
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className={cn(!hasContent && "opacity-50")}>
        <CardContent className="p-4 space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={handleSave}
            disabled={!hasContent}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save to Library
              </>
            )}
          </Button>

          <Button variant="ghost" className="w-full justify-start gap-2" disabled={!hasContent}>
            <Sparkles className="h-4 w-4" />
            Generate 3 Variations
          </Button>

          <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleCopy} disabled={!hasContent}>
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2" disabled={!hasContent}>
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-4 w-4 ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Copy as Plain Text
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="mr-2 h-4 w-4" />
                Download as .txt
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileDown className="mr-2 h-4 w-4" />
                Download as .docx
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileDown className="mr-2 h-4 w-4" />
                Download as .pdf
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* Version History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <Card className={cn(!hasContent && "opacity-50")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Version History
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", historyOpen && "rotate-180")}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">{version.timestamp}</p>
                    <p className="text-sm text-foreground truncate max-w-[150px]">{version.preview}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" disabled={!hasContent}>
                    Restore
                  </Button>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
