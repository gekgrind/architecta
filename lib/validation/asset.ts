import { z } from "zod";

import {
  ALLOWED_OPENAI_IMAGE_MODELS,
  ALLOWED_OPENAI_VIDEO_MODELS,
} from "@/lib/ai/llm/policy";

export const imageGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  prompt: z.string().min(1).max(4000),
  size: z
    .enum(["1024x1024", "1024x1536", "1536x1024", "auto"])
    .default("1024x1024"),
  quality: z.enum(["low", "medium", "high", "auto"]).default("high"),
  // Server allowlist only; arbitrary model ids are rejected.
  model: z.enum(ALLOWED_OPENAI_IMAGE_MODELS).default("gpt-image-1"),
});

export const videoGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  prompt: z.string().min(1).max(4000),
  durationSeconds: z.number().int().min(2).max(60).default(8),
  model: z.enum(ALLOWED_OPENAI_VIDEO_MODELS).default("sora-2"),
});

export type ImageGenerateInput = z.infer<typeof imageGenerateInputSchema>;
export type VideoGenerateInput = z.infer<typeof videoGenerateInputSchema>;
