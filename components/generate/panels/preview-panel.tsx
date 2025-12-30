"use client";

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ContentType } from "@/lib/types"
import { Sparkles, RefreshCw, Twitter, Linkedin, FileText } from "lucide-react"

interface PreviewPanelProps {
  content: string
  isGenerating: boolean
  contentType: ContentType
  onContentChange: (content: string) => void
  onRegenerate: () => void
}

export function PreviewPanel({ content, isGenerating, contentType, onContentChange, onRegenerate }: PreviewPanelProps) {
  const [previewTab, setPreviewTab] = useState("edit")

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  // Empty State
  if (!content && !isGenerating) {
    return (
      <Card className="flex items-center justify-center h-full min-h-[400px]">
        <CardContent className="text-center p-8">
          <div className="rounded-full bg-muted p-6 mb-4 mx-auto w-fit">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to create amazing content?</h3>
          <p className="text-muted-foreground max-w-sm">
            Fill in the details on the left and hit Generate to create your first piece of content.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Generating State
  if (isGenerating) {
    return (
      <Card className="flex items-center justify-center h-full min-h-[400px] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 animate-pulse" />
        <CardContent className="text-center p-8 relative z-10">
          <div className="relative mb-4 mx-auto w-fit">
            <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            <div className="rounded-full bg-primary/10 p-6">
              <Sparkles className="h-10 w-10 text-primary animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Creating your content...</h3>
          <p className="text-muted-foreground">Our AI is crafting something amazing for you.</p>
        </CardContent>
      </Card>
    )
  }

  // Content State
  return (
    <Card className="flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Tabs value={previewTab} onValueChange={setPreviewTab}>
          <TabsList className="h-9">
            <TabsTrigger value="edit" className="text-xs">
              Edit
            </TabsTrigger>
            {contentType === "tweet" && (
              <TabsTrigger value="twitter" className="text-xs gap-1">
                <Twitter className="h-3 w-3" /> Twitter
              </TabsTrigger>
            )}
            {contentType === "linkedin_post" && (
              <TabsTrigger value="linkedin" className="text-xs gap-1">
                <Linkedin className="h-3 w-3" /> LinkedIn
              </TabsTrigger>
            )}
            <TabsTrigger value="plain" className="text-xs gap-1">
              <FileText className="h-3 w-3" /> Plain
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="ghost" size="sm" onClick={onRegenerate} className="text-muted-foreground gap-1">
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </Button>
      </div>

      <CardContent className="flex-1 p-4">
        <Tabs value={previewTab} onValueChange={setPreviewTab} className="h-full">
          <TabsContent value="edit" className="h-full mt-0">
            <Textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="h-full min-h-[300px] resize-none border-0 focus-visible:ring-0 p-0 text-base"
              placeholder="Your generated content will appear here..."
            />
          </TabsContent>

          <TabsContent value="twitter" className="mt-0">
            <TwitterPreview content={content} />
          </TabsContent>

          <TabsContent value="linkedin" className="mt-0">
            <LinkedInPreview content={content} />
          </TabsContent>

          <TabsContent value="plain" className="mt-0">
            <div className="whitespace-pre-wrap text-foreground font-mono text-sm bg-muted/50 rounded-lg p-4 min-h-[300px]">
              {content}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Character/Word Counter */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
    </Card>
  )
}

function TwitterPreview({ content }: { content: string }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold">JD</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground">John Doe</span>
              <span className="text-muted-foreground">@johndoe</span>
              <span className="text-muted-foreground">· 1m</span>
            </div>
            <div className="mt-2 text-foreground whitespace-pre-wrap">{content}</div>
            <div className="flex gap-8 mt-4 text-muted-foreground">
              <span className="text-sm">💬 12</span>
              <span className="text-sm">🔄 45</span>
              <span className="text-sm">❤️ 234</span>
              <span className="text-sm">📊 1.2K</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LinkedInPreview({ content }: { content: string }) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold">JD</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">John Doe</p>
            <p className="text-sm text-muted-foreground">CEO at TechFlow Solutions</p>
            <p className="text-xs text-muted-foreground">1m · 🌐</p>
          </div>
        </div>
        <div className="text-foreground whitespace-pre-wrap mb-4">{content}</div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground border-t border-border pt-3">
          <span>👍 24</span>
          <span className="mx-2">·</span>
          <span>8 comments</span>
          <span className="mx-2">·</span>
          <span>3 reposts</span>
        </div>
      </div>
    </div>
  )
}
