"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Sparkles, Edit } from "lucide-react"
import Link from "next/link"

interface SuccessStepProps {
  formData: {
    brandName: string
    industry: string
    demographics: string
    toneAttributes: string[]
  }
  onEdit: () => void
}

export function SuccessStep({ formData, onEdit }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Success Animation */}
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <div className="relative rounded-full bg-emerald-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Your Brand Kit is Ready!</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Great job! Your brand voice has been configured and is ready to generate amazing content.
      </p>

      {/* Summary Card */}
      <Card className="w-full max-w-md mb-8">
        <CardContent className="p-6 text-left space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Brand</p>
            <p className="font-semibold text-foreground">{formData.brandName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Industry</p>
            <p className="font-medium text-foreground">{formData.industry}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Target Audience</p>
            <p className="font-medium text-foreground line-clamp-2">{formData.demographics}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tone</p>
            <div className="flex flex-wrap gap-2">
              {formData.toneAttributes.slice(0, 3).map((tone) => (
                <Badge key={tone} variant="secondary" className="bg-secondary/20 text-secondary">
                  {tone}
                </Badge>
              ))}
              {formData.toneAttributes.length > 3 && (
                <Badge variant="outline">+{formData.toneAttributes.length - 3} more</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/generate">
          <Button className="gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90">
            <Sparkles className="h-4 w-4" />
            Generate Your First Content
          </Button>
        </Link>
        <Button variant="outline" onClick={onEdit} className="gap-2 bg-transparent">
          <Edit className="h-4 w-4" />
          Edit Brand Kit
        </Button>
      </div>
    </div>
  )
}
