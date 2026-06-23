"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Film,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

type ImageAsset = {
  id: string;
  assetType: "image";
  signedUrl: string | null;
  prompt: string;
  width: number | null;
  height: number | null;
};

type StoryboardShot = {
  index: number;
  durationSeconds: number;
  visual: string;
  onScreenText?: string;
  voiceover?: string;
  bRoll?: string;
};

type Storyboard = {
  summary: string;
  shots: StoryboardShot[];
  totalDurationSeconds: number;
  recommendedAspectRatio: "9:16" | "1:1" | "16:9";
  suggestedMusic?: string;
};

type VideoAsset = {
  id: string;
  assetType: "video";
  status: "ready" | "storyboard";
  signedUrl: string | null;
  prompt: string;
  durationSeconds: number | null;
  storyboard?: Storyboard;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

interface Props {
  postId: string;
  defaultPrompt: string;
}

export function VisualAssetsCard({ postId, defaultPrompt }: Props) {
  const { toast } = useToast();

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState(defaultPrompt);
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024");
  const [imageBusy, setImageBusy] = useState(false);
  const [image, setImage] = useState<ImageAsset | null>(null);

  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState(defaultPrompt);
  const [videoDuration, setVideoDuration] = useState(8);
  const [videoBusy, setVideoBusy] = useState(false);
  const [video, setVideo] = useState<VideoAsset | null>(null);

  async function generateImage() {
    if (!imagePrompt.trim() || imageBusy) return;
    setImageBusy(true);
    try {
      const res = await fetch("/api/assets/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          prompt: imagePrompt,
          size: imageSize,
          quality: "high",
        }),
      });
      const json = (await res.json()) as ApiResponse<{ asset: ImageAsset }>;
      if (!json.ok) {
        toast({
          title: "Image generation failed",
          description: json.error.message,
          variant: "destructive",
        });
        return;
      }
      setImage(json.data.asset);
      setImageDialogOpen(false);
      toast({ title: "Image ready", description: "Saved to this post." });
    } catch (err) {
      toast({
        title: "Image generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImageBusy(false);
    }
  }

  async function generateVideo() {
    if (!videoPrompt.trim() || videoBusy) return;
    setVideoBusy(true);
    try {
      const res = await fetch("/api/assets/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          prompt: videoPrompt,
          durationSeconds: videoDuration,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ asset: VideoAsset }>;
      if (!json.ok) {
        toast({
          title: "Video generation failed",
          description: json.error.message,
          variant: "destructive",
        });
        return;
      }
      setVideo(json.data.asset);
      setVideoDialogOpen(false);
      toast({
        title:
          json.data.asset.status === "ready"
            ? "Video ready"
            : "Storyboard ready",
        description:
          json.data.asset.status === "ready"
            ? "Saved to this post."
            : "Sora unavailable — a structured storyboard was saved instead.",
      });
    } catch (err) {
      toast({
        title: "Video generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-secondary" />
          Visual assets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => {
            setImagePrompt(image?.prompt ?? defaultPrompt);
            setImageDialogOpen(true);
          }}
        >
          <ImageIcon className="h-4 w-4" />
          {image ? "Regenerate image" : "Generate image"}
        </Button>
        {image && (
          <div className="space-y-2 rounded-lg border border-border bg-background p-2">
            {image.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.signedUrl}
                alt={image.prompt}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />
            )}
            <div className="flex items-center justify-between">
              <span className="truncate text-xs text-muted-foreground">
                {image.width && image.height
                  ? `${image.width}×${image.height}`
                  : "Image"}
              </span>
              {image.signedUrl && (
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1">
                  <a href={image.signedUrl} download target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    <span className="text-xs">Download</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => {
            setVideoPrompt(video?.prompt ?? defaultPrompt);
            setVideoDialogOpen(true);
          }}
        >
          <Film className="h-4 w-4" />
          {video ? "Regenerate video" : "Generate video"}
        </Button>
        {video && (
          <div
            className={cn(
              "space-y-2 rounded-lg border bg-background p-3",
              video.status === "storyboard"
                ? "border-amber-500/30"
                : "border-border"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {video.status === "ready" ? "Video" : "Storyboard"}
              </span>
              {video.signedUrl && (
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1">
                  <a href={video.signedUrl} download target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {video.status === "ready" ? "Download" : "Open JSON"}
                    </span>
                  </a>
                </Button>
              )}
            </div>
            {video.status === "ready" && video.signedUrl ? (
              <video
                controls
                src={video.signedUrl}
                className="aspect-video w-full rounded-md bg-black"
              />
            ) : video.storyboard ? (
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">{video.storyboard.summary}</p>
                <ol className="space-y-1.5">
                  {video.storyboard.shots.map((shot) => (
                    <li
                      key={shot.index}
                      className="rounded-md border border-border bg-muted/40 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Shot {shot.index}</span>
                        <span className="text-muted-foreground">
                          {shot.durationSeconds}s
                        </span>
                      </div>
                      <p className="mt-1 text-foreground">{shot.visual}</p>
                      {shot.onScreenText && (
                        <p className="mt-1 text-muted-foreground">
                          On-screen: {shot.onScreenText}
                        </p>
                      )}
                      {shot.voiceover && (
                        <p className="mt-0.5 text-muted-foreground">
                          VO: {shot.voiceover}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="text-muted-foreground">
                  ~{video.storyboard.totalDurationSeconds}s &middot;{" "}
                  {video.storyboard.recommendedAspectRatio}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>

      {/* Image dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate image</DialogTitle>
            <DialogDescription>
              Describe the visual. The generated image is saved to this post and
              your asset library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="image-prompt">Prompt</Label>
              <Textarea
                id="image-prompt"
                rows={5}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="A clean isometric illustration of..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image-size">Aspect</Label>
              <Select
                value={imageSize}
                onValueChange={(value) => setImageSize(value as ImageSize)}
              >
                <SelectTrigger id="image-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">Square (1024×1024)</SelectItem>
                  <SelectItem value="1024x1536">Portrait (1024×1536)</SelectItem>
                  <SelectItem value="1536x1024">Landscape (1536×1024)</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setImageDialogOpen(false)}
              disabled={imageBusy}
            >
              Cancel
            </Button>
            <Button onClick={generateImage} disabled={!imagePrompt.trim() || imageBusy}>
              {imageBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate video</DialogTitle>
            <DialogDescription>
              If your OpenAI account can&apos;t reach Sora, Architecta returns a
              structured storyboard you can hand to an editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="video-prompt">Prompt</Label>
              <Textarea
                id="video-prompt"
                rows={5}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="A 9:16 vertical product showcase..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-duration">Duration (seconds)</Label>
              <Select
                value={String(videoDuration)}
                onValueChange={(value) => setVideoDuration(Number(value))}
              >
                <SelectTrigger id="video-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 seconds</SelectItem>
                  <SelectItem value="8">8 seconds</SelectItem>
                  <SelectItem value="12">12 seconds</SelectItem>
                  <SelectItem value="20">20 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setVideoDialogOpen(false)}
              disabled={videoBusy}
            >
              Cancel
            </Button>
            <Button onClick={generateVideo} disabled={!videoPrompt.trim() || videoBusy}>
              {videoBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
