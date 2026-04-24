"use client";

import { useState } from "react";
import { ControlsPanel } from "./panels/controls-panel";
import { PreviewPanel } from "./panels/preview-panel";
import { ActionsPanel } from "./panels/actions-panel";
import type { GenerationUIConfig, ContentType } from "@/lib/types";

const initialConfig: GenerationUIConfig = {
  contentType: "linkedin",
  topic: "",
  keyPoints: [""],
  tone: 50,
  length: "medium",
  structure: "stepwise",
  keywords: [],
  includeCTA: true,
  ctaText: "",
};

export function GenerateStudio() {
  const [config, setConfig] = useState<GenerationUIConfig>(initialConfig);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentScore, setContentScore] = useState<number | null>(null);

  const updateConfig = (data: Partial<GenerationUIConfig>) => {
    setConfig((prev) => ({ ...prev, ...data }));
  };

  const handleGenerate = async () => {
    if (!config.topic.trim()) return;

    setIsGenerating(true);
    setGeneratedContent("");
    setContentScore(null);

    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockContent = generateMockContent(config);
    setGeneratedContent(mockContent);
    setContentScore(Math.floor(Math.random() * 20) + 75);
    setIsGenerating(false);
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleContentChange = (content: string) => {
    setGeneratedContent(content);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr,280px] min-h-[calc(100vh-12rem)]">
      <ControlsPanel
        config={config}
        updateConfig={updateConfig}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
      <PreviewPanel
        content={generatedContent}
        isGenerating={isGenerating}
        contentType={config.contentType}
        onContentChange={handleContentChange}
        onRegenerate={handleRegenerate}
      />
      <ActionsPanel
        hasContent={!!generatedContent}
        contentScore={contentScore}
        content={generatedContent}
      />
    </div>
  );
}

function generateMockContent(config: GenerationUIConfig): string {
  const templates: Partial<Record<ContentType, string>> = {
    tweet: `The secret to ${config.topic || "success"}?

It's not about working harder.
It's about working smarter.

Here's the thing most people miss:
→ Focus on systems, not goals
→ Build habits that compound
→ Measure what matters

What's your #1 productivity tip? 👇`,

    linkedin: `I've been thinking about ${config.topic || "this topic"} a lot lately.

And here's what I've realized:

The most successful teams don't just work harder—they work differently.

${
  config.keyPoints
    .filter(Boolean)
    .map((point, i) => `${i + 1}. ${point}`)
    .join("\n") ||
  "1. They prioritize ruthlessly\n2. They communicate clearly\n3. They iterate quickly"
}

The bottom line? ${config.topic || "Success"} isn't about perfection. It's about progress.

${
  config.includeCTA && config.ctaText
    ? config.ctaText
    : "What strategies have worked for you? I'd love to hear your thoughts in the comments."
}`,

    blog: `# ${config.topic || "Untitled Post"}

In today's fast-paced world, ${config.topic || "this topic"} has become more important than ever.

## Why It Matters

${
  config.keyPoints
    .filter(Boolean)
    .map((point) => `- ${point}`)
    .join("\n") || "- Point 1\n- Point 2\n- Point 3"
}

## Key Takeaways

Consistency beats intensity every time.

${
  config.includeCTA && config.ctaText
    ? `\n---\n\n${config.ctaText}`
    : ""
}`,

    email: `Subject: ${config.topic || "Quick update"}

Hi there,

I wanted to share something that's been on my mind about ${config.topic || "this topic"}.

${
  config.keyPoints
    .filter(Boolean)
    .map((point) => `• ${point}`)
    .join("\n") || "• Key insight 1\n• Key insight 2\n• Key insight 3"
}

${
  config.includeCTA && config.ctaText
    ? config.ctaText
    : "Reply and let me know your thoughts!"
}

Best,
[Your Name]`,

    ad: `🎯 ${config.topic || "Transform Your Results"} 🎯

Tired of ${config.keyPoints[0] || "struggling with the same problems"}?

Here's how we can help:
✅ ${config.keyPoints[0] || "Benefit 1"}
✅ ${config.keyPoints[1] || "Benefit 2"}
✅ ${config.keyPoints[2] || "Benefit 3"}

${
  config.includeCTA && config.ctaText
    ? config.ctaText
    : "Click below to get started →"
}`,
  };

  return templates[config.contentType] ?? templates.linkedin ?? "";
}
