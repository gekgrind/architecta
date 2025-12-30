"use client";

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ClipboardList, X } from "lucide-react"

interface ContentRulesStepProps {
  formData: {
    topicsInclude: string[]
    topicsAvoid: string[]
    bannedPhrases: string[]
    requiredElements: string[]
  }
  updateFormData: (data: Partial<ContentRulesStepProps["formData"]>) => void
}

const requiredElementOptions = [
  { id: "cta", label: "Always include a CTA" },
  { id: "question", label: "Always ask a question" },
  { id: "emojis", label: "Always use emojis" },
  { id: "hashtags", label: "Always include hashtags" },
]

export function ContentRulesStep({ formData, updateFormData }: ContentRulesStepProps) {
  const [includeInput, setIncludeInput] = useState("")
  const [avoidInput, setAvoidInput] = useState("")
  const [phraseInput, setPhraseInput] = useState("")

  const addTopic = (type: "include" | "avoid") => {
    const input = type === "include" ? includeInput : avoidInput
    const field = type === "include" ? "topicsInclude" : "topicsAvoid"

    if (input.trim()) {
      updateFormData({
        [field]: [...formData[field], input.trim()],
      })
      if (type === "include") setIncludeInput("")
      else setAvoidInput("")
    }
  }

  const removeTopic = (type: "include" | "avoid", index: number) => {
    const field = type === "include" ? "topicsInclude" : "topicsAvoid"
    updateFormData({
      [field]: formData[field].filter((_, i) => i !== index),
    })
  }

  const addPhrase = () => {
    if (phraseInput.trim()) {
      updateFormData({
        bannedPhrases: [...formData.bannedPhrases, phraseInput.trim()],
      })
      setPhraseInput("")
    }
  }

  const removePhrase = (index: number) => {
    updateFormData({
      bannedPhrases: formData.bannedPhrases.filter((_, i) => i !== index),
    })
  }

  const toggleElement = (id: string) => {
    if (formData.requiredElements.includes(id)) {
      updateFormData({
        requiredElements: formData.requiredElements.filter((e) => e !== id),
      })
    } else {
      updateFormData({
        requiredElements: [...formData.requiredElements, id],
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,200px]">
      <div className="space-y-6">
        {/* Topics to Include */}
        <div className="space-y-3">
          <Label>Topics to Include</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a topic..."
              value={includeInput}
              onChange={(e) => setIncludeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic("include"))}
            />
            <Button type="button" variant="outline" onClick={() => addTopic("include")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.topicsInclude.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.topicsInclude.map((topic, index) => (
                <Badge key={index} variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                  {topic}
                  <button onClick={() => removeTopic("include", index)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Topics to Avoid */}
        <div className="space-y-3">
          <Label>Topics to Avoid</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a topic to avoid..."
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic("avoid"))}
            />
            <Button type="button" variant="outline" onClick={() => addTopic("avoid")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.topicsAvoid.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.topicsAvoid.map((topic, index) => (
                <Badge key={index} variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200">
                  {topic}
                  <button onClick={() => removeTopic("avoid", index)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Banned Phrases */}
        <div className="space-y-3">
          <Label>Banned Phrases</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a phrase to ban..."
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhrase())}
            />
            <Button type="button" variant="outline" onClick={addPhrase}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.bannedPhrases.length > 0 && (
            <div className="space-y-2">
              {formData.bannedPhrases.map((phrase, index) => (
                <div key={index} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                  <span className="text-sm">{phrase}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhrase(index)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Required Elements */}
        <div className="space-y-3">
          <Label>Required Elements</Label>
          <div className="space-y-3">
            {requiredElementOptions.map((option) => (
              <div key={option.id} className="flex items-center gap-3">
                <Checkbox
                  id={option.id}
                  checked={formData.requiredElements.includes(option.id)}
                  onCheckedChange={() => toggleElement(option.id)}
                />
                <label htmlFor={option.id} className="text-sm cursor-pointer">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Icon */}
      <div className="hidden lg:flex items-start justify-center pt-8">
        <div className="rounded-full bg-primary/10 p-6">
          <ClipboardList className="h-12 w-12 text-primary" />
        </div>
      </div>
    </div>
  )
}
