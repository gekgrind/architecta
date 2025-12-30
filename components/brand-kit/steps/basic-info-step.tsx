"use client";

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CharacterCounter } from "@/components/ui/character-counter"
import { industries } from "@/lib/mock-data"
import { Building2 } from "lucide-react"

interface BasicInfoStepProps {
  formData: {
    brandName: string
    industry: string
    website: string
    description: string
  }
  updateFormData: (data: Partial<BasicInfoStepProps["formData"]>) => void
}

export function BasicInfoStep({ formData, updateFormData }: BasicInfoStepProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,200px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="brandName">Brand Name *</Label>
          <Input
            id="brandName"
            placeholder="e.g., TechFlow Solutions"
            value={formData.brandName}
            onChange={(e) => updateFormData({ brandName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry *</Label>
          <Select value={formData.industry} onValueChange={(value) => updateFormData({ industry: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website URL</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://yourwebsite.com"
            value={formData.website}
            onChange={(e) => updateFormData({ website: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Short Brand Description</Label>
            <CharacterCounter current={formData.description.length} max={200} />
          </div>
          <Textarea
            id="description"
            placeholder="Briefly describe what your brand does and who it serves..."
            value={formData.description}
            onChange={(e) => {
              if (e.target.value.length <= 200) {
                updateFormData({ description: e.target.value })
              }
            }}
            className="min-h-[100px] resize-none"
          />
        </div>
      </div>

      {/* Visual Icon */}
      <div className="hidden lg:flex items-start justify-center pt-8">
        <div className="rounded-full bg-primary/10 p-6">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
      </div>
    </div>
  )
}
