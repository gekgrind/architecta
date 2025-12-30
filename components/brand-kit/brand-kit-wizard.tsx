"use client";

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BasicInfoStep } from "./steps/basic-info-step"
import { TargetAudienceStep } from "./steps/target-audience-step"
import { BrandVoiceStep } from "./steps/brand-voice-step"
import { ContentRulesStep } from "./steps/content-rules-step"
import { ExamplePostsStep } from "./steps/example-posts-step"
import { SuccessStep } from "./steps/success-step"
import type { ExamplePost } from "@/lib/types"
import { ArrowLeft, ArrowRight, Save } from "lucide-react"

const steps = [
  { id: 1, title: "Basic Information" },
  { id: 2, title: "Target Audience" },
  { id: 3, title: "Brand Voice & Tone" },
  { id: 4, title: "Content Rules" },
  { id: 5, title: "Example Posts" },
]

interface BrandKitFormData {
  brandName: string
  industry: string
  website: string
  description: string
  demographics: string
  painPoints: string[]
  goals: string[]
  toneAttributes: string[]
  voiceDescription: string
  topicsInclude: string[]
  topicsAvoid: string[]
  bannedPhrases: string[]
  requiredElements: string[]
  examplePosts: ExamplePost[]
}

const initialFormData: BrandKitFormData = {
  brandName: "",
  industry: "",
  website: "",
  description: "",
  demographics: "",
  painPoints: [""],
  goals: [""],
  toneAttributes: [],
  voiceDescription: "",
  topicsInclude: [],
  topicsAvoid: [],
  bannedPhrases: [],
  requiredElements: [],
  examplePosts: [],
}

export function BrandKitWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<BrandKitFormData>(initialFormData)
  const [isComplete, setIsComplete] = useState(false)

  const progress = (currentStep / steps.length) * 100

  const updateFormData = (data: Partial<BrandKitFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1)
    } else {
      setIsComplete(true)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.brandName.trim() !== "" && formData.industry !== ""
      case 2:
        return formData.demographics.trim() !== ""
      case 3:
        return formData.toneAttributes.length > 0
      case 4:
        return true
      case 5:
        return formData.examplePosts.length >= 3
      default:
        return true
    }
  }

  if (isComplete) {
    return (
      <SuccessStep
        formData={formData}
        onEdit={() => {
          setIsComplete(false)
          setCurrentStep(1)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {steps.length}
            </p>
            <h2 className="text-xl font-semibold text-foreground">{steps[currentStep - 1].title}</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Save className="mr-2 h-4 w-4" />
            Save as Draft
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`text-xs font-medium ${step.id <= currentStep ? "text-primary" : "text-muted-foreground"}`}
            >
              {step.id}. {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === 1 && <BasicInfoStep formData={formData} updateFormData={updateFormData} />}
          {currentStep === 2 && <TargetAudienceStep formData={formData} updateFormData={updateFormData} />}
          {currentStep === 3 && <BrandVoiceStep formData={formData} updateFormData={updateFormData} />}
          {currentStep === 4 && <ContentRulesStep formData={formData} updateFormData={updateFormData} />}
          {currentStep === 5 && <ExamplePostsStep formData={formData} updateFormData={updateFormData} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
        >
          {currentStep === steps.length ? "Complete" : "Next"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
