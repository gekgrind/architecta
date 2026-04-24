"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  index: number;
}

export default function QuickActionCard({
  title,
  description,
  icon: Icon,
  gradient,
  index,
}: QuickActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative overflow-hidden rounded-lg
        bg-blueprint-panel/70 backdrop-blur-md
        border border-blueprint-cyan/25
        hover:border-blueprint-cyan/60
        transition-all duration-300 cursor-pointer
        hover:shadow-lg hover:shadow-blueprint-cyan/10"
    >
      {/* Gradient overlay on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0
          group-hover:opacity-5 transition-opacity duration-300`}
      />

      <div className="relative p-6 space-y-4">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient}
            flex items-center justify-center
            group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h4 className="text-lg font-medium text-foreground group-hover:text-blueprint-cyan transition-colors">
            {title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Arrow indicator */}
        <div className="flex items-center gap-2 text-blueprint-cyan opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs font-mono uppercase tracking-widest">
            Launch
          </span>
          <svg
            className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
