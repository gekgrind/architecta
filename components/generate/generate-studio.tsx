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

const PLATFORM_BY_CONTENT_TYPE: Partial<Record<ContentType, string>> = {
  linkedin: "linkedin",
  tweet: "x",
  blog: "blog",
  email: "email",
  ad: "linkedin",
};

function toPlatform(contentType: ContentType): string {
  return PLATFORM_BY_CONTENT_TYPE[contentType] ?? "linkedin";
}

function formatGeneratedPost(post: {
  hook: string | null;
  caption: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[];
}): string {
  const segments: string[] = [];
  if (post.hook) segments.push(post.hook);
  const body = post.caption || post.body;
  if (body) segments.push(body);
  if (post.cta) segments.push(post.cta);
  if (post.hashtags?.length) {
    segments.push(post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
  }
  return segments.filter(Boolean).join("\n\n");
}

export function GenerateStudio() {
  const [config, setConfig] = useState<GenerationUIConfig>(initialConfig);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentScore, setContentScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  const updateConfig = (data: Partial<GenerationUIConfig>) => {
    setConfig((prev) => ({ ...prev, ...data }));
  };

  const handleGenerate = async () => {
    if (!config.topic.trim()) return;

    setIsGenerating(true);
    setGeneratedContent("");
    setContentScore(null);
    setError(null);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: toPlatform(config.contentType),
          topic: config.topic,
          keyPoints: config.keyPoints.filter(Boolean),
          tone: config.tone < 33 ? "casual" : config.tone > 66 ? "bold" : "balanced",
          length: config.length,
          includeCta: config.includeCTA,
          ctaText: config.ctaText,
          keywords: config.keywords,
          generateImagePrompt: false,
          generateVideoPrompt: false,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: {
          post: {
            id: string;
            hook: string | null;
            caption: string | null;
            body: string | null;
            cta: string | null;
            hashtags: string[];
          };
        };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.ok || !json.data?.post) {
        throw new Error(json?.error?.message ?? `Generation failed (${res.status})`);
      }

      setPostId(json.data.post.id);
      setGeneratedContent(formatGeneratedPost(json.data.post));
      setContentScore(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    void handleGenerate();
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
      <div className="flex flex-col gap-4">
        <PreviewPanel
          content={generatedContent}
          isGenerating={isGenerating}
          contentType={config.contentType}
          onContentChange={handleContentChange}
          onRegenerate={handleRegenerate}
        />
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
      <ActionsPanel
        hasContent={!!generatedContent}
        contentScore={contentScore}
        content={generatedContent}
        postId={postId ?? undefined}
        visualPrompt={
          config.topic.trim()
            ? `${config.topic.trim()}\n\n${generatedContent}`.trim()
            : generatedContent
        }
      />
    </div>
  );
}
