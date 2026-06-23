import type { BrandKit } from "./types"

export const mockBrandKit: BrandKit = {
  id: "1",
  brandName: "TechFlow Solutions",
  industry: "SaaS",
  website: "https://techflow.io",
  description: "Streamlining workflows for modern teams",
  targetAudience: {
    demographics: "B2B tech leaders, 30-50, decision makers",
    painPoints: ["Complex workflows", "Data silos", "Team alignment"],
    goals: ["Increase efficiency", "Better collaboration", "Data-driven decisions"],
  },
  toneAttributes: ["Professional", "Educational", "Conversational"],
  voiceDescription: "We speak like a trusted advisor—clear, confident, and helpful without being condescending.",
  topics: {
    include: ["Productivity", "SaaS tools", "Team collaboration", "Automation"],
    avoid: ["Politics", "Controversial topics", "Competitor bashing"],
  },
  bannedPhrases: ["Game-changer", "Leverage", "Synergy"],
  requiredElements: ["CTA", "Question"],
  examplePosts: [
    {
      id: "1",
      type: "LinkedIn Post",
      content:
        "Your team is wasting 12 hours per week on manual data entry. Here's how we helped Acme Corp automate it: [3 key steps]. What's your biggest workflow bottleneck?",
      whyItWorks:
        "Starts with a specific pain point, offers a solution, includes social proof, ends with engagement question",
    },
    {
      id: "2",
      type: "Tweet",
      content:
        "Stop treating symptoms. Start fixing systems. The difference between a busy team and a productive one? 🎯 One unified workflow. What's holding your team back?",
      whyItWorks: "Short, punchy, uses contrast, includes emoji strategically, ends with question",
    },
    {
      id: "3",
      type: "Blog Intro",
      content:
        "When Sarah joined as VP of Operations at a 200-person SaaS company, she inherited 47 different spreadsheets tracking the same data. Sound familiar?",
      whyItWorks: "Opens with story, specific details create credibility, rhetorical question creates connection",
    },
  ],
  createdAt: "2024-12-01T10:00:00Z",
  updatedAt: "2024-12-15T14:30:00Z",
}

export const toneAttributes = [
  "Professional",
  "Casual",
  "Witty",
  "Educational",
  "Inspirational",
  "Conversational",
  "Authoritative",
  "Playful",
]

export const industries = ["SaaS", "E-commerce", "Agency", "Consulting", "Creator/Influencer", "Other"]

export const contentStructures = [
  { value: "hook-body-cta", label: "Hook + Body + CTA" },
  { value: "problem-solution-proof", label: "Problem + Solution + Proof" },
  { value: "story-lesson-action", label: "Story + Lesson + Action" },
  { value: "question-answer-next", label: "Question + Answer + Next Steps" },
  { value: "custom", label: "Custom" },
]
