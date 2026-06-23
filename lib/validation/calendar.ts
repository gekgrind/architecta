import { z } from "zod";

import { calendarStatusSchema, platformSchema } from "./common";

export const calendarItemInputSchema = z.object({
  workspaceId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  scheduledFor: z.string().datetime(),
  platform: platformSchema,
  status: calendarStatusSchema.default("scheduled"),
  notes: z.string().max(2000).nullish(),
});

export const calendarItemPatchSchema = z.object({
  scheduledFor: z.string().datetime().optional(),
  status: calendarStatusSchema.optional(),
  notes: z.string().max(2000).nullish(),
  platform: platformSchema.optional(),
});

export type CalendarItemInput = z.infer<typeof calendarItemInputSchema>;
export type CalendarItemPatch = z.infer<typeof calendarItemPatchSchema>;
