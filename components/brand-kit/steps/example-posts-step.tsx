"use client";

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { CharacterCounter } from "@/components/ui/character-counter"
import type { ExamplePost } from "@/lib/types"
import { Plus, Trash2, Trophy, AlertCircle } from "lucide-react"

interface ExamplePostsStepProps {
  formData: {
    examplePosts: ExamplePost[]
  }
  updateFormData: (data: Partial<ExamplePostsStepProps["formData"]>) => void
}

const contentTypes: ExamplePost["type"][] = ["Tweet", "LinkedIn Post", "Blog Intro", "Email Subject"]

export function ExamplePostsStep({ formData, updateFormData }: ExamplePostsStepProps) {
  const addExample = () => {
    const newExample: ExamplePost = {
      id: Date.now().toString(),
      type: "Tweet",
      content: "",
      whyItWorks: "",
    }
    updateFormData({ examplePosts: [...formData.examplePosts, newExample] })
  }

  const removeExample = (id: string) => {
    updateFormData({
      examplePosts: formData.examplePosts.filter((post) => post.id !== id),
    })
  }

  const updateExample = (id: string, field: keyof ExamplePost, value: string) => {
    updateFormData({
      examplePosts: formData.examplePosts.map((post) => (post.id === id ? { ...post, [field]: value } : post)),
    })
  }

  const needsMoreExamples = formData.examplePosts.length < 3

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,200px]">
      <div className="space-y-6">
        <div>
          <h3 className="font-medium text-foreground mb-1">
            Add 3-5 example posts that represent your brand&apos;s best work
          </h3>
          <p className="text-sm text-muted-foreground">
            These examples help the AI understand your unique style and voice
          </p>
        </div>

        {needsMoreExamples && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              Please add at least {3 - formData.examplePosts.length} more example
              {3 - formData.examplePosts.length > 1 ? "s" : ""} to continue
            </span>
          </div>
        )}

        <div className="space-y-4">
          {formData.examplePosts.map((post, index) => (
            <Card key={post.id} className="relative">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Example {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExample(post.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select value={post.type} onValueChange={(value) => updateExample(post.id, "type", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {contentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Content</Label>
                    <CharacterCounter current={post.content.length} max={500} />
                  </div>
                  <Textarea
                    placeholder="Paste or write your example content..."
                    value={post.content}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        updateExample(post.id, "content", e.target.value)
                      }
                    }}
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Why it works</Label>
                    <CharacterCounter current={post.whyItWorks.length} max={150} />
                  </div>
                  <Textarea
                    placeholder="Explain what makes this content effective..."
                    value={post.whyItWorks}
                    onChange={(e) => {
                      if (e.target.value.length <= 150) {
                        updateExample(post.id, "whyItWorks", e.target.value)
                      }
                    }}
                    className="min-h-[60px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {formData.examplePosts.length < 5 && (
          <Button
            type="button"
            variant="outline"
            onClick={addExample}
            className="w-full border-dashed gap-2 bg-transparent"
          >
            <Plus className="h-4 w-4" />
            Add Another Example
          </Button>
        )}
      </div>

      {/* Visual Icon */}
      <div className="hidden lg:flex items-start justify-center pt-8">
        <div className="rounded-full bg-primary/10 p-6">
          <Trophy className="h-12 w-12 text-primary" />
        </div>
      </div>
    </div>
  )
}
