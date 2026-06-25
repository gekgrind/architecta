import { z } from "zod";

export const connectablePlatformSchema = z.enum([
  "linkedin",
  "instagram",
  "facebook",
  "threads",
]);

export const publishInputSchema = z.object({
  // Optional override; defaults to the post's own platform when omitted.
  platform: connectablePlatformSchema.optional(),
});

export type ConnectablePlatform = z.infer<typeof connectablePlatformSchema>;
export type PublishInput = z.infer<typeof publishInputSchema>;
