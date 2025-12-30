import type { BrandKit, ContentItem } from "./types"

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

export const mockContentItems: ContentItem[] = [
  {
    id: "1",
    contentType: "linkedin",
    title: "Q4 Planning Tips",
    content:
      "Q4 is coming fast. Here are 3 things every SaaS leader should prioritize:\n\n1. Audit your tech stack - what's redundant?\n2. Set clear OKRs with your team\n3. Build in buffer time for unexpected fires\n\nWhat's your #1 Q4 priority?",
    status: "published",
    campaign: "Q4 Launch Campaign",
    tags: ["planning", "leadership", "saas"],
    createdAt: "2024-12-15T10:30:00Z",
    publishedAt: "2024-12-16T09:00:00Z",
    performanceData: {
      impressions: 2847,
      engagements: 184,
      clicks: 42,
    },
  },
  {
    id: "2",
    contentType: "tweet",
    title: "Productivity Hack",
    content:
      "The most productive teams don't work harder.\n\nThey eliminate friction.\n\nHere's how: Automate the boring stuff. 🚀",
    status: "published",
    campaign: "Thought Leadership",
    tags: ["productivity", "automation"],
    createdAt: "2024-12-14T08:00:00Z",
    publishedAt: "2024-12-14T12:00:00Z",
    performanceData: {
      impressions: 5420,
      engagements: 312,
      clicks: 89,
    },
  },
  {
    id: "3",
    contentType: "blog",
    title: "The Ultimate Guide to Workflow Automation",
    content:
      "In this comprehensive guide, we'll explore how modern teams are saving 10+ hours per week through strategic workflow automation...",
    status: "draft",
    tags: ["automation", "guide", "productivity"],
    createdAt: "2024-12-13T15:00:00Z",
  },
  {
    id: "4",
    contentType: "email",
    title: "Welcome Email Sequence - Day 1",
    content: "Welcome to TechFlow! 👋\n\nYou've just taken the first step toward reclaiming your team's time...",
    status: "scheduled",
    campaign: "Onboarding Sequence",
    tags: ["email", "onboarding"],
    createdAt: "2024-12-12T11:00:00Z",
  },
  {
    id: "5",
    contentType: "ad",
    title: "LinkedIn Ad - Product Launch",
    content:
      "Tired of context switching between 10 different tools?\n\nTechFlow brings it all together.\n\n✅ One dashboard\n✅ Zero data silos\n✅ Happy teams\n\nStart your free trial →",
    status: "published",
    campaign: "Product Launch",
    tags: ["ad", "linkedin", "launch"],
    createdAt: "2024-12-10T09:00:00Z",
    publishedAt: "2024-12-11T08:00:00Z",
    performanceData: {
      impressions: 12500,
      engagements: 430,
      clicks: 156,
    },
  },
  {
    id: "6",
    contentType: "linkedin",
    title: "Remote Work Tips",
    content: "Remote work isn't the future.\n\nIt's the present.\n\nBut most teams are doing it wrong...",
    status: "archived",
    tags: ["remote", "teams"],
    createdAt: "2024-11-20T10:00:00Z",
  },
]

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
