"use client";

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Users } from "lucide-react"

interface TargetAudienceStepProps {
  formData: {
    demographics: string
    painPoints: string[]
    goals: string[]
  }
  updateFormData: (data: Partial<TargetAudienceStepProps["formData"]>) => void
}

export function TargetAudienceStep({ formData, updateFormData }: TargetAudienceStepProps) {
  const addPainPoint = () => {
    if (formData.painPoints.length < 5) {
      updateFormData({ painPoints: [...formData.painPoints, ""] })
    }
  }

  const removePainPoint = (index: number) => {
    const newPainPoints = formData.painPoints.filter((_, i) => i !== index)
    updateFormData({ painPoints: newPainPoints.length ? newPainPoints : [""] })
  }

  const updatePainPoint = (index: number, value: string) => {
    const newPainPoints = [...formData.painPoints]
    newPainPoints[index] = value
    updateFormData({ painPoints: newPainPoints })
  }

  const addGoal = () => {
    if (formData.goals.length < 5) {
      updateFormData({ goals: [...formData.goals, ""] })
    }
  }

  const removeGoal = (index: number) => {
    const newGoals = formData.goals.filter((_, i) => i !== index)
    updateFormData({ goals: newGoals.length ? newGoals : [""] })
  }

  const updateGoal = (index: number, value: string) => {
    const newGoals = [...formData.goals]
    newGoals[index] = value
    updateFormData({ goals: newGoals })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,200px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="demographics">Demographics *</Label>
          <Textarea
            id="demographics"
            placeholder="e.g., 25-45 year old professionals in tech, decision makers at mid-size companies..."
            value={formData.demographics}
            onChange={(e) => updateFormData({ demographics: e.target.value })}
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Pain Points (max 5)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPainPoint}
              disabled={formData.painPoints.length >= 5}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.painPoints.map((point, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Pain point ${index + 1}`}
                  value={point}
                  onChange={(e) => updatePainPoint(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePainPoint(index)}
                  disabled={formData.painPoints.length === 1}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Goals (max 5)</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addGoal} disabled={formData.goals.length >= 5}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.goals.map((goal, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Goal ${index + 1}`}
                  value={goal}
                  onChange={(e) => updateGoal(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGoal(index)}
                  disabled={formData.goals.length === 1}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Icon */}
      <div className="hidden lg:flex items-start justify-center pt-8">
        <div className="rounded-full bg-primary/10 p-6">
          <Users className="h-12 w-12 text-primary" />
        </div>
      </div>
    </div>
  )
}
