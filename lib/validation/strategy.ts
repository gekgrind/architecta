import { z } from "zod";

import { strategyStatusSchema } from "./common";

export const strategyGenerateInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  brandProfileId: z.string().uuid().nullish(),
  businessNiche: z.string().min(1).max(500),
  targetAudience: z.string().min(1).max(2000),
  contentGoals: z.string().max(2000).optional(),
  offerProduct: z.string().max(2000).optional(),
  preferredPlatforms: z.array(z.string().min(1).max(60)).min(1).max(20),
  toneBrandStyle: z.string().max(2000).optional(),
  currentChallenge: z.string().max(2000).optional(),
  primaryGoal: z.string().max(2000).optional(),
});

export const strategyPatchSchema = z.object({
  title: z.string().max(200).optional(),
  summary: z.string().max(8000).optional(),
  status: strategyStatusSchema.optional(),
  pillars: z.array(z.unknown()).optional(),
  platformStrategy: z.record(z.unknown()).optional(),
  audienceAngles: z.array(z.string()).optional(),
  contentThemes: z.array(z.string()).optional(),
  postingCadence: z.array(z.string()).optional(),
  quickWins: z.array(z.string()).optional(),
  nextActions: z.array(z.string()).optional(),
});

export type StrategyGenerateInput = z.infer<typeof strategyGenerateInputSchema>;
export type StrategyPatch = z.infer<typeof strategyPatchSchema>;
