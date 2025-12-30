"use client";

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toneAttributes } from "@/lib/mock-data"
import { Mic, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandVoiceStepProps {
  formData: {
    toneAttributes: string[]
    voiceDescription: string
  }
  updateFormData: (data: Partial<BrandVoiceStepProps["formData"]>) => void
}

export function BrandVoiceStep({ formData, updateFormData }: BrandVoiceStepProps) {
  const toggleTone = (tone: string) => {
    if (formData.toneAttributes.includes(tone)) {
      updateFormData({
        toneAttributes: formData.toneAttributes.filter((t) => t !== tone),
      })
    } else {
      updateFormData({
        toneAttributes: [...formData.toneAttributes, tone],
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,200px]">
      <div className="space-y-6">
        <div className="space-y-3">
          <Label>Tone Attributes *</Label>
          <p className="text-sm text-muted-foreground">Select the attributes that best describe your brand voice</p>
          <div className="flex flex-wrap gap-2">
            {toneAttributes.map((tone) => {
              const isSelected = formData.toneAttributes.includes(tone)
              return (
                <button
                  key={tone}
                  type="button"
                  onClick={() => toggleTone(tone)}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    isSelected
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {tone}
                  {isSelected && <X className="ml-2 h-3 w-3" />}
                </button>
              )
            })}
          </div>
          {formData.toneAttributes.length > 0 && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-2">Selected:</p>
              <div className="flex flex-wrap gap-2">
                {formData.toneAttributes.map((tone) => (
                  <Badge
                    key={tone}
                    variant="secondary"
                    className="bg-secondary/20 text-secondary hover:bg-secondary/30"
                  >
                    {tone}
                    <button onClick={() => toggleTone(tone)} className="ml-1 hover:text-secondary-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="voiceDescription">Voice Description</Label>
          <p className="text-sm text-muted-foreground">Describe how your brand should sound in more detail</p>
          <Textarea
            id="voiceDescription"
            placeholder="e.g., We speak like a trusted advisor—clear, confident, and helpful without being condescending..."
            value={formData.voiceDescription}
            onChange={(e) => updateFormData({ voiceDescription: e.target.value })}
            className="min-h-[120px] resize-none"
          />
        </div>
      </div>

      {/* Visual Icon */}
      <div className="hidden lg:flex items-start justify-center pt-8">
        <div className="rounded-full bg-primary/10 p-6">
          <Mic className="h-12 w-12 text-primary" />
        </div>
      </div>
    </div>
  )
}
