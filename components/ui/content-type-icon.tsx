"use client";

import type React from "react"

import { cn } from "@/lib/utils"
import type { ContentType } from "@/lib/types"
import { Twitter, Linkedin, FileText, Mail, Megaphone } from "lucide-react"

interface ContentTypeIconProps {
  type: ContentType
  className?: string
  size?: number
}

const iconConfig: Partial<Record<ContentType, { icon: React.ElementType; color: string }>> = {
  tweet: {
    icon: Twitter,
    color: "text-sky-500",
  },
  thread: {
    icon: Twitter,
    color: "text-sky-500",
  },
  linkedin: {
    icon: Linkedin,
    color: "text-blue-600",
  },
  linkedin_post: {
    icon: Linkedin,
    color: "text-blue-600",
  },
  blog: {
    icon: FileText,
    color: "text-emerald-600",
  },
  blog_outline: {
    icon: FileText,
    color: "text-emerald-600",
  },
  blog_post: {
    icon: FileText,
    color: "text-emerald-600",
  },
  article_longform: {
    icon: FileText,
    color: "text-emerald-600",
  },
  email: {
    icon: Mail,
    color: "text-purple-600",
  },
  ad: {
    icon: Megaphone,
    color: "text-orange-500",
  },
  ad_copy: {
    icon: Megaphone,
    color: "text-orange-500",
  },
  landing_page: {
    icon: FileText,
    color: "text-indigo-600",
  },
  product_description: {
    icon: FileText,
    color: "text-teal-600",
  },
}

export function ContentTypeIcon({ type, className, size = 16 }: ContentTypeIconProps) {
  const config = iconConfig[type] ?? iconConfig.tweet
  if (!config) return null
  const Icon = config.icon

  return <Icon className={cn(config.color, className)} size={size} />
}
