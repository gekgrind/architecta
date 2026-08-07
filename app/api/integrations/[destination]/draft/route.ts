import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  POST_FOR_DESTINATION_COLUMNS,
  buildDestinationContent,
  resolveAssetUrl,
  runDestination,
  type PostForDestination,
} from "@/lib/integrations/drafts";
import { getAdapter, isDestinationId } from "@/lib/integrations/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { destinationDraftSchema } from "@/lib/validation/integrations";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ destination: string }> };

/**
 * Create a draft in the destination. This is the only destination action that
 * doesn't require a separate approval — nothing here goes live or gets sent.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const { destination } = await ctx.params;
  if (!isDestinationId(destination)) {
    return apiError("not_found", "Unknown destination");
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const adapter = getAdapter(destination);
  if (!adapter || !adapter.implemented) {
    return apiError("bad_request", `${destination} drafts are not available yet`);
  }

  const body = await parseJsonBody<unknown>(req);
  const parsed = destinationDraftSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid draft request", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const { postId, ...overrides } = parsed.data;

  const { data: post, error: postError } = await supabase
    .from("architecta_posts")
    .select(POST_FOR_DESTINATION_COLUMNS)
    .eq("user_id", session.user.id)
    .eq("id", postId)
    .maybeSingle();

  if (postError) return apiError("server_error", postError.message);
  if (!post) return apiError("not_found", "Post not found");

  const typedPost = post as unknown as PostForDestination;
  const featuredImageUrl = await resolveAssetUrl(
    supabase,
    session.user.id,
    typedPost.image_asset_id
  );

  const outcome = await runDestination({
    supabase,
    userId: session.user.id,
    destination,
    content: buildDestinationContent(typedPost, overrides, featuredImageUrl),
    action: { kind: "draft" },
    postId: typedPost.id,
    campaignId: typedPost.campaign_id,
  });

  if (!outcome.ok) return apiError("upstream_error", outcome.error);

  return apiOk({
    created: true,
    status: outcome.status,
    externalId: outcome.externalId,
    externalUrl: outcome.externalUrl,
  });
}
