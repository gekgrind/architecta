import { z } from "zod";

export const imageGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  prompt: z.string().min(1).max(4000),
  size: z
    .enum(["1024x1024", "1024x1536", "1536x1024", "auto"])
    .default("1024x1024"),
  quality: z.enum(["low", "medium", "high", "auto"]).default("high"),
  model: z.string().min(1).default("gpt-image-1"),
});

export const videoGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  prompt: z.string().min(1).max(4000),
  durationSeconds: z.number().int().min(2).max(60).default(8),
  model: z.string().min(1).default("sora-2"),
});

export type ImageGenerateInput = z.infer<typeof imageGenerateInputSchema>;
export type VideoGenerateInput = z.infer<typeof videoGenerateInputSchema>;
