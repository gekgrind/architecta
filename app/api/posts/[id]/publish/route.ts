import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import {
  CONNECTIONS_TABLE,
  type ConnectionRow,
} from "@/lib/publishing/connections";
import { isPlatformId } from "@/lib/publishing/registry";
import { publishPost, type PostForPublish } from "@/lib/publishing/publish";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const limited = await enforceRateLimit(session.user.id, RATE_LIMITS.publish);
  if (limited) return limited;

  const { data: post, error: postError } = await supabase
    .from("architecta_posts")
    .select(
      "id, user_id, platform, title, hook, caption, body, cta, hashtags, image_asset_id, video_asset_id, meta, status, publish_attempts"
    )
    .eq("user_id", session.user.id)
    .eq("id", id)
    .maybeSingle();

  if (postError) return apiError("server_error", postError.message);
  if (!post) return apiError("not_found", "Post not found");

  if (post.status === "published" || post.status === "publishing") {
    return apiError(
      "bad_request",
      post.status === "published"
        ? "This post has already been published."
        : "This post is already being published.",
      { status: 409, details: { code: "already_publishing", status: post.status } }
    );
  }

  if (!isPlatformId(post.platform)) {
    return apiError(
      "bad_request",
      `This post's platform (${post.platform}) can't be published to directly`
    );
  }

  const { data: connection, error: connError } = await supabase
    .from(CONNECTIONS_TABLE)
    .select("*")
    .eq("user_id", session.user.id)
    .eq("platform", post.platform)
    .maybeSingle();

  if (connError) return apiError("server_error", connError.message);
  if (!connection) {
    return apiError("not_found", `No ${post.platform} account connected`);
  }
  if ((connection as ConnectionRow).status !== "connected") {
    return apiError(
      "bad_request",
      `Your ${post.platform} connection needs to be reconnected`,
      { details: { code: "reconnect_required", platform: post.platform } }
    );
  }

  const outcome = await publishPost({
    supabase,
    post: post as PostForPublish,
    connection: connection as ConnectionRow,
    trigger: "manual",
  });

  if (!outcome.ok) {
    if (outcome.code === "already_publishing") {
      return apiError("bad_request", outcome.error, {
        status: 409,
        details: { code: outcome.code },
      });
    }
    return apiError("upstream_error", outcome.error, {
      details: { code: outcome.code, platform: post.platform },
    });
  }

  return apiOk({
    published: true,
    externalPostId: outcome.externalPostId,
    externalUrl: outcome.externalUrl,
    recorded: outcome.recorded,
  });
}
