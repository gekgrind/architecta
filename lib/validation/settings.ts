import { z } from "zod";

import { platformSchema, textProviderSchema } from "./common";

export const userSettingsSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  textProvider: textProviderSchema.default("anthropic"),
  anthropicModel: z.string().min(1).default("claude-sonnet-4-6"),
  openaiTextModel: z.string().min(1).default("gpt-4o"),
  openaiImageModel: z.string().min(1).default("gpt-image-1"),
  openaiVideoModel: z.string().min(1).nullish(),
  defaultPlatforms: z.array(platformSchema).default(["linkedin", "instagram", "x"]),
  approvalRequired: z.boolean().default(false),
  imageStyle: z.record(z.unknown()).default({}),
  videoStyle: z.record(z.unknown()).default({}),
});

export const userSettingsPatchSchema = userSettingsSchema.partial();

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type UserSettingsPatch = z.infer<typeof userSettingsPatchSchema>;
