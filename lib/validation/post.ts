import { z } from "zod";

import { platformSchema, postStatusSchema } from "./common";

export const postGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  strategyId: z.string().uuid().nullish(),
  platform: platformSchema,
  topic: z.string().min(1).max(500),
  keyPoints: z.array(z.string().max(500)).max(20).default([]),
  tone: z.string().max(200).optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  includeCta: z.boolean().default(true),
  ctaText: z.string().max(500).optional(),
  keywords: z.array(z.string().max(120)).max(50).default([]),
  generateImagePrompt: z.boolean().default(true),
  generateVideoPrompt: z.boolean().default(false),
});

export const postPatchSchema = z.object({
  title: z.string().max(200).optional(),
  hook: z.string().max(2000).optional(),
  caption: z.string().max(8000).optional(),
  body: z.string().max(20000).optional(),
  hashtags: z.array(z.string().max(120)).max(60).optional(),
  cta: z.string().max(500).optional(),
  imagePrompt: z.string().max(2000).optional(),
  videoPrompt: z.string().max(2000).optional(),
  status: postStatusSchema.optional(),
  scheduledFor: z.string().datetime().nullish(),
  publishedAt: z.string().datetime().nullish(),
});

export const postReviseInputSchema = z.object({
  tone: z.enum(["same", "clearer", "bolder", "warmer", "tighter"]).default("same"),
  length: z.enum(["same", "shorter", "longer"]).default("same"),
  ctaStrength: z.enum(["same", "stronger", "subtle"]).default("same"),
  customInstructions: z.string().max(2000).optional(),
});

export type PostGenerateInput = z.infer<typeof postGenerateInputSchema>;
export type PostPatch = z.infer<typeof postPatchSchema>;
export type PostReviseInput = z.infer<typeof postReviseInputSchema>;
