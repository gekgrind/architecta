import { z } from "zod";

import { campaignStatusSchema, platformSchema } from "./common";

export const campaignGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  strategyId: z.string().uuid().nullish(),
  name: z.string().min(1).max(200),
  theme: z.string().min(1).max(2000),
  goal: z.string().min(1).max(2000),
  launchDate: z.string().date().nullish(),
  platforms: z.array(platformSchema).min(1).max(20),
  postsPerPlatform: z.number().int().min(1).max(20).default(3),
  includeEmail: z.boolean().default(true),
  includeBlog: z.boolean().default(false),
});

export const campaignPatchSchema = z.object({
  name: z.string().max(200).optional(),
  theme: z.string().max(2000).optional(),
  goal: z.string().max(2000).optional(),
  launchDate: z.string().date().nullish(),
  status: campaignStatusSchema.optional(),
});

export type CampaignGenerateInput = z.infer<typeof campaignGenerateInputSchema>;
export type CampaignPatch = z.infer<typeof campaignPatchSchema>;
