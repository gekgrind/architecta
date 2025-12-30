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

const iconConfig: Record<ContentType, { icon: React.ElementType; color: string }> = {
  tweet: {
    icon: Twitter,
    color: "text-sky-500",
  },
  linkedin: {
    icon: Linkedin,
    color: "text-blue-600",
  },
  blog: {
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
}

export function ContentTypeIcon({ type, className, size = 16 }: ContentTypeIconProps) {
  const config = iconConfig[type]
  const Icon = config.icon

  return <Icon className={cn(config.color, className)} size={size} />
}
