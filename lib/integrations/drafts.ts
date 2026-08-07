import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDecryptedCredentials,
  getDestinationRow,
  saveRefreshedCredentials,
  toIdentity,
} from "./connections";
import { getAdapter } from "./registry";
import {
  DestinationNotImplementedError,
  type DestinationContent,
  type DestinationId,
} from "./types";

export const PUBLICATION_JOBS_TABLE = "architecta_publication_jobs";

/** The post columns a destination needs. */
export type PostForDestination = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  platform: string;
  title: string | null;
  hook: string | null;
  caption: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[] | null;
  image_asset_id: string | null;
  meta: Record<string, unknown> | null;
};

export const POST_FOR_DESTINATION_COLUMNS =
  "id, user_id, campaign_id, platform, title, hook, caption, body, cta, hashtags, image_asset_id, meta";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generated post copy is plain text, so escape it and wrap each block in a
 * paragraph rather than trusting it as markup.
 */
export function toHtmlBody(segments: Array<string | null | undefined>): string {
  return segments
    .filter((s): s is string => Boolean(s && s.trim()))
    .flatMap((segment) => segment.split(/\n{2,}/))
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type DestinationContentOverrides = Partial<
  Pick<
    DestinationContent,
    "title" | "slug" | "categories" | "tags" | "subject" | "audience"
  >
>;

/** Assemble a post row into the content a destination adapter accepts. */
export function buildDestinationContent(
  post: PostForDestination,
  overrides: DestinationContentOverrides = {},
  featuredImageUrl: string | null = null
): DestinationContent {
  const title = overrides.title?.trim() || post.title?.trim() || "Untitled draft";
  const text = [post.hook, post.body || post.caption, post.cta]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n\n");

  return {
    title,
    html: toHtmlBody([post.hook, post.body || post.caption, post.cta]),
    text: text || null,
    slug: overrides.slug?.trim() || slugify(title) || null,
    categories: overrides.categories ?? [],
    tags: overrides.tags ?? (post.hashtags ?? []).map((h) => h.replace(/^#/, "")),
    featuredImageUrl,
    subject: overrides.subject?.trim() || title,
    audience: overrides.audience ?? null,
  };
}

/** Signed URL for a generated asset, for adapters that re-upload the bytes. */
export async function resolveAssetUrl(
  supabase: SupabaseClient,
  userId: string,
  assetId: string | null
): Promise<string | null> {
  if (!assetId) return null;
  const { data } = await supabase
    .from("architecta_generated_assets")
    .select("storage_bucket, storage_path, external_url")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  if (!data) return null;
  if (data.external_url) return data.external_url as string;
  if (data.storage_bucket && data.storage_path) {
    const { data: signed } = await supabase.storage
      .from(data.storage_bucket as string)
      .createSignedUrl(data.storage_path as string, 60 * 60);
    return signed?.signedUrl ?? null;
  }
  return null;
}

export type DestinationAction =
  | { kind: "draft" }
  | { kind: "publish"; externalId?: string | null }
  | { kind: "schedule"; externalId?: string | null; scheduledFor: string };

export type DestinationOutcome =
  | {
      ok: true;
      externalId: string;
      externalUrl: string | null;
      status: "draft" | "published" | "sent" | "scheduled";
    }
  | { ok: false; error: string };

/**
 * Run one destination action for a user, always recording the attempt in
 * architecta_publication_jobs. Never throws — callers get a discriminated
 * outcome so a single failed destination can't take down a batch.
 *
 * `draft` is the only action reachable without a separate explicit approval;
 * `publish` and `schedule` are wired to their own user-triggered routes.
 */
export async function runDestination(args: {
  supabase: SupabaseClient;
  userId: string;
  destination: DestinationId;
  content: DestinationContent;
  action: DestinationAction;
  postId?: string | null;
  campaignId?: string | null;
  trigger?: "manual" | "campaign";
}): Promise<DestinationOutcome> {
  const {
    supabase,
    userId,
    destination,
    content,
    action,
    postId = null,
    campaignId = null,
    trigger = "manual",
  } = args;

  try {
    const adapter = getAdapter(destination);
    if (!adapter || !adapter.implemented) {
      throw new DestinationNotImplementedError(destination);
    }

    const row = await getDestinationRow(supabase, userId, destination);
    if (!row) throw new Error(`No ${destination} connection`);
    if (row.status !== "connected") {
      throw new Error(`Your ${destination} connection needs to be reconnected`);
    }

    const session = {
      credentials: getDecryptedCredentials(row),
      identity: toIdentity(row),
      // OAuth destinations refresh mid-call; persist the rotated credential so
      // the next request doesn't have to refresh again.
      onCredentialsRefreshed: async (next: {
        secret: string;
        refreshSecret?: string | null;
        expiresAt?: string | null;
      }) => {
        await saveRefreshedCredentials(supabase, userId, destination, next);
      },
    };

    const result =
      action.kind === "draft"
        ? await adapter.createDraft({ ...session, content })
        : action.kind === "publish"
          ? await adapter.publish({
              ...session,
              content,
              externalId: action.externalId ?? null,
            })
          : await adapter.schedule({
              ...session,
              content,
              externalId: action.externalId ?? null,
              scheduledFor: action.scheduledFor,
            });

    await supabase.from(PUBLICATION_JOBS_TABLE).insert({
      user_id: userId,
      post_id: postId,
      campaign_id: campaignId,
      destination,
      action: action.kind,
      status: "success",
      external_id: result.externalId || null,
      external_url: result.externalUrl,
      trigger,
      meta: { result_status: result.status },
    });

    return {
      ok: true,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      status: result.status,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Destination request failed";
    await supabase.from(PUBLICATION_JOBS_TABLE).insert({
      user_id: userId,
      post_id: postId,
      campaign_id: campaignId,
      destination,
      action: action.kind,
      status: "error",
      error,
      trigger,
    });
    return { ok: false, error };
  }
}
