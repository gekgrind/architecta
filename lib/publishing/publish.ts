import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getDecryptedTokens, type ConnectionRow } from "./connections";
import { getAdapter } from "./registry";
import type { PlatformId } from "./adapters/types";

export type PostForPublish = {
  id: string;
  user_id: string;
  platform: string;
  title: string | null;
  hook: string | null;
  caption: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[] | null;
  image_asset_id: string | null;
  video_asset_id: string | null;
  meta: Record<string, unknown> | null;
};

export type PublishOutcome =
  | { ok: true; externalPostId: string; externalUrl: string | null }
  | { ok: false; error: string };

/** Assemble the post's fields into a single body of text to publish. */
export function buildPostText(post: PostForPublish): string {
  const segments: string[] = [];
  if (post.hook) segments.push(post.hook);
  const main = post.caption || post.body;
  if (main) segments.push(main);
  if (post.cta) segments.push(post.cta);
  if (post.hashtags?.length) {
    segments.push(post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
  }
  return segments.filter(Boolean).join("\n\n").trim();
}

async function resolveAssetUrl(
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

/**
 * Publish a single post to its connected platform. Always records an entry in
 * architecta_publish_log; updates the post + calendar item only on success.
 * Never throws — returns a discriminated outcome so callers (incl. the cron
 * loop) can continue past a single failure.
 */
export async function publishPost(args: {
  supabase: SupabaseClient;
  post: PostForPublish;
  connection: ConnectionRow;
  trigger: "manual" | "scheduled";
}): Promise<PublishOutcome> {
  const { supabase, post, connection, trigger } = args;
  const platform = post.platform as PlatformId;

  try {
    const adapter = getAdapter(platform);
    const { accessToken } = getDecryptedTokens(connection);
    if (!connection.external_account_id) {
      throw new Error("Connection is missing the external account id");
    }

    const text = buildPostText(post);
    if (!text) throw new Error("Post has no content to publish");

    const imageUrl = await resolveAssetUrl(supabase, post.user_id, post.image_asset_id);
    const videoUrl = await resolveAssetUrl(supabase, post.user_id, post.video_asset_id);

    const result = await adapter.publish({
      accessToken,
      externalAccountId: connection.external_account_id,
      text,
      imageUrl,
      videoUrl,
    });

    const nowIso = new Date().toISOString();
    await supabase
      .from("architecta_posts")
      .update({
        status: "published",
        published_at: nowIso,
        meta: {
          ...(post.meta ?? {}),
          external_post: {
            platform,
            id: result.externalPostId,
            url: result.externalUrl,
            published_at: nowIso,
          },
        },
      })
      .eq("user_id", post.user_id)
      .eq("id", post.id);

    // Keep any linked calendar item in sync.
    await supabase
      .from("architecta_content_calendar_items")
      .update({ status: "published" })
      .eq("user_id", post.user_id)
      .eq("post_id", post.id);

    await supabase.from("architecta_publish_log").insert({
      user_id: post.user_id,
      post_id: post.id,
      platform,
      status: "success",
      external_post_id: result.externalPostId || null,
      external_url: result.externalUrl,
      trigger,
    });

    return { ok: true, externalPostId: result.externalPostId, externalUrl: result.externalUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    await supabase.from("architecta_publish_log").insert({
      user_id: post.user_id,
      post_id: post.id,
      platform,
      status: "error",
      error: message,
      trigger,
    });
    return { ok: false, error: message };
  }
}
