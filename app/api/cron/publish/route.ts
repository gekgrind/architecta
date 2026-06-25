import { timingSafeEqual } from "node:crypto";

import { apiError, apiOk } from "@/lib/api/response";
import {
  CONNECTIONS_TABLE,
  type ConnectionRow,
} from "@/lib/publishing/connections";
import { isPlatformId } from "@/lib/publishing/registry";
import { publishPost, type PostForPublish } from "@/lib/publishing/publish";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 50;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return apiError("unauthorized", "Unauthorized");
  }

  const supabase = await createSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const { data: duePosts, error } = await supabase
    .from("architecta_posts")
    .select(
      "id, user_id, platform, title, hook, caption, body, cta, hashtags, image_asset_id, meta"
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH);

  if (error) return apiError("server_error", error.message);

  let published = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of duePosts ?? []) {
    const post = row as PostForPublish;

    if (!isPlatformId(post.platform)) {
      skipped += 1;
      continue;
    }

    const { data: connection } = await supabase
      .from(CONNECTIONS_TABLE)
      .select("*")
      .eq("user_id", post.user_id)
      .eq("platform", post.platform)
      .maybeSingle();

    if (!connection || (connection as ConnectionRow).status !== "connected") {
      skipped += 1;
      continue;
    }

    const outcome = await publishPost({
      supabase,
      post,
      connection: connection as ConnectionRow,
      trigger: "scheduled",
    });
    if (outcome.ok) published += 1;
    else failed += 1;
  }

  return apiOk({ scanned: duePosts?.length ?? 0, published, failed, skipped });
}
