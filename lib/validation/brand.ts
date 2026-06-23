import { z } from "zod";

export const brandProfilePatchSchema = z.object({
  brandName: z.string().min(1).max(120).optional(),
  industry: z.string().max(120).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  description: z.string().max(2000).optional(),
  audience: z.string().max(2000).optional(),
  tone: z.string().max(2000).optional(),
  toneVoice: z.string().max(2000).optional(),
  voiceDescription: z.string().max(2000).optional(),
  topics: z
    .object({
      include: z.array(z.string()).default([]),
      avoid: z.array(z.string()).default([]),
    })
    .partial()
    .optional(),
  offers: z.string().max(4000).optional(),
  mission: z.string().max(2000).optional(),
  vision: z.string().max(2000).optional(),
  values: z.string().max(2000).optional(),
  typicalCustomers: z.string().max(2000).optional(),
  bannedPhrases: z.array(z.string().max(120)).max(200).optional(),
  requiredElements: z.array(z.string().max(120)).max(200).optional(),
  examplePosts: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string().max(60),
        content: z.string().max(4000).optional(),
        whyItWorks: z.string().max(2000).optional(),
        title: z.string().max(200).optional(),
      })
    )
    .max(20)
    .optional(),
  aiPreferences: z.record(z.unknown()).optional(),
});

export type BrandProfilePatch = z.infer<typeof brandProfilePatchSchema>;
