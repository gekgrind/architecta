import { z } from "zod";

export const destinationIdSchema = z.enum([
  "wordpress",
  "ghost",
  "custom",
  "gmail",
  "microsoft",
  "brevo",
]);

/**
 * WordPress connects with a site URL, username, and an Application Password
 * (Users → Profile → Application Passwords) — never the account password.
 */
export const wordpressConnectSchema = z.object({
  siteUrl: z.string().min(1).max(500),
  username: z.string().min(1).max(200),
  applicationPassword: z.string().min(1).max(200),
});

/**
 * Ghost connects with a site URL and an Admin API key (Settings →
 * Integrations), which arrives as `id:secret`. The Content API key is
 * read-only and can't create posts, so it's rejected by the adapter.
 */
export const ghostConnectSchema = z.object({
  siteUrl: z.string().min(1).max(500),
  adminApiKey: z.string().min(1).max(300),
});

/**
 * A custom site connects with the user's own endpoint and credential. Both are
 * stored per user — there is no app-level webhook. `authHeader` names the
 * header the credential rides in; it defaults to Authorization.
 */
export const customConnectSchema = z.object({
  webhookUrl: z.string().min(1).max(500),
  authHeader: z.string().max(100).optional(),
  authValue: z.string().min(1).max(500),
});

/**
 * Brevo's API key normally comes from BREVO_API_KEY, so the form only needs a
 * sender — a key typed here overrides the env var for this user. `senderEmail`
 * must already be verified in Brevo; left blank, the first verified sender on
 * the account is used.
 */
export const brevoConnectSchema = z.object({
  apiKey: z.string().max(300).optional(),
  senderEmail: z.string().max(200).optional(),
});

/** Fields the user may override on top of the generated post content. */
export const destinationContentOverridesSchema = z.object({
  title: z.string().max(300).optional(),
  slug: z.string().max(200).optional(),
  categories: z.array(z.string().max(120)).max(20).optional(),
  tags: z.array(z.string().max(120)).max(50).optional(),
  subject: z.string().max(300).optional(),
  audience: z.string().max(200).optional(),
});

export const destinationDraftSchema = destinationContentOverridesSchema.extend({
  postId: z.string().uuid(),
});

/**
 * Going live is always a separate call from creating the draft, and carries an
 * explicit `approved: true` so a publish or send can never be an accident.
 * `externalId` promotes a draft this adapter already created; without it the
 * destination receives the content directly.
 */
export const destinationPublishSchema = destinationContentOverridesSchema.extend({
  postId: z.string().uuid(),
  externalId: z.string().min(1).max(200).optional(),
  approved: z.literal(true),
  scheduledFor: z.string().datetime().optional(),
});

export type DestinationIdInput = z.infer<typeof destinationIdSchema>;
export type WordpressConnectInput = z.infer<typeof wordpressConnectSchema>;
export type GhostConnectInput = z.infer<typeof ghostConnectSchema>;
export type CustomConnectInput = z.infer<typeof customConnectSchema>;
export type BrevoConnectInput = z.infer<typeof brevoConnectSchema>;
export type DestinationDraftInput = z.infer<typeof destinationDraftSchema>;
export type DestinationPublishInput = z.infer<typeof destinationPublishSchema>;
