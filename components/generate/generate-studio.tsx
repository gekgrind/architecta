"use client";

import { useRef, useState } from "react";
import { ControlsPanel } from "./panels/controls-panel";
import { PreviewPanel } from "./panels/preview-panel";
import { ActionsPanel } from "./panels/actions-panel";
import { matchesSavedPost, savePostContent, type SavedPost } from "./save-post-content";
import { composePostText } from "@/lib/publishing/post-text";
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

export function GenerateStudio() {
  const [config, setConfig] = useState<GenerationUIConfig>(initialConfig);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentScore, setContentScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  // Last server-confirmed state of the post; the editor is "saved" only when it matches.
  const [savedPost, setSavedPost] = useState<SavedPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const activePostIdRef = useRef<string | null>(null);

  const updateConfig = (data: Partial<GenerationUIConfig>) => {
    setConfig((prev) => ({ ...prev, ...data }));
  };

  const handleGenerate = async () => {
    if (!config.topic.trim()) return;

    setIsGenerating(true);
    setGeneratedContent("");
    setContentScore(null);
    setError(null);
    setSaveSucceeded(false);

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

      activePostIdRef.current = json.data.post.id;
      setPostId(json.data.post.id);
      setSavedPost(json.data.post);
      setGeneratedContent(composePostText(json.data.post));
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
    setSaveSucceeded(false);
  };

  const handleSave = async () => {
    if (!postId || !savedPost || isSaving) return;

    setIsSaving(true);
    setSaveSucceeded(false);
    setError(null);

    const result = await savePostContent({
      postId,
      content: generatedContent,
      saved: savedPost,
    });

    setIsSaving(false);
    // A regenerate while the save was in flight replaced the post — drop the stale result.
    if (activePostIdRef.current !== postId) return;

    if (result.ok) {
      setSavedPost(result.post);
      setSaveSucceeded(true);
    } else {
      // Keep the local edit; it is still unsaved and the user can retry.
      setError(`Your edits were not saved: ${result.error}. Try Save again.`);
    }
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
        onSave={handleSave}
        isSaving={isSaving}
        isSaved={saveSucceeded && matchesSavedPost(generatedContent, savedPost)}
        visualPrompt={
          config.topic.trim()
            ? `${config.topic.trim()}\n\n${generatedContent}`.trim()
            : generatedContent
        }
      />
    </div>
  );
}
