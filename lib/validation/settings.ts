import { z } from "zod";

import {
  ALLOWED_ANTHROPIC_MODELS,
  ALLOWED_OPENAI_IMAGE_MODELS,
  ALLOWED_OPENAI_TEXT_MODELS,
  ALLOWED_OPENAI_VIDEO_MODELS,
} from "@/lib/ai/llm/policy";

import { platformSchema, textProviderSchema } from "./common";

export const userSettingsSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  // "auto" lets task routing choose; paid providers are only pinned explicitly.
  textProvider: textProviderSchema.default("auto"),
  // Model ids must be on the server allowlist (lib/ai/llm/policy.ts).
  anthropicModel: z.enum(ALLOWED_ANTHROPIC_MODELS).default("claude-sonnet-4-6"),
  openaiTextModel: z.enum(ALLOWED_OPENAI_TEXT_MODELS).default("gpt-4o"),
  openaiImageModel: z.enum(ALLOWED_OPENAI_IMAGE_MODELS).default("gpt-image-1"),
  openaiVideoModel: z.enum(ALLOWED_OPENAI_VIDEO_MODELS).nullish(),
  defaultPlatforms: z.array(platformSchema).default(["linkedin", "instagram", "x"]),
  approvalRequired: z.boolean().default(false),
  imageStyle: z.record(z.unknown()).default({}),
  videoStyle: z.record(z.unknown()).default({}),
});

export const userSettingsPatchSchema = userSettingsSchema.partial();

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type UserSettingsPatch = z.infer<typeof userSettingsPatchSchema>;
