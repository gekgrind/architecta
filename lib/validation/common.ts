import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const optionalUuidSchema = z.string().uuid().nullish();
export const isoDateSchema = z.string().datetime();

export const platformSchema = z.enum([
  "linkedin",
  "instagram",
  "x",
  "twitter",
  "facebook",
  "tiktok",
  "pinterest",
  "youtube",
  "blog",
  "email",
  "newsletter",
  "threads",
]);

export const postStatusSchema = z.enum([
  "idea",
  "draft",
  "approved",
  "scheduled",
  "published",
  "archived",
]);

export const calendarStatusSchema = z.enum([
  "idea",
  "draft",
  "approved",
  "scheduled",
  "published",
]);

export const campaignStatusSchema = z.enum([
  "idea",
  "planning",
  "active",
  "complete",
  "archived",
]);

export const strategyStatusSchema = z.enum(["draft", "active", "archived"]);

export const textProviderSchema = z.enum(["anthropic", "openai", "auto"]);

export type Platform = z.infer<typeof platformSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type StrategyStatus = z.infer<typeof strategyStatusSchema>;
export type TextProvider = z.infer<typeof textProviderSchema>;
