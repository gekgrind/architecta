import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  buildStoryboardPrompt,
  generateVideo,
  VideoNotAvailableError,
  type Storyboard,
} from "@/lib/ai/llm/providers/openai-video";
import { extractJson } from "@/lib/ai/llm/json";
import { runGateway } from "@/lib/ai/llm/run";
import { getUserAiPreference } from "@/lib/ai/llm/preferences";
import { enforceAiUsage, RATE_LIMITS } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { videoGenerateInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const ASSET_BUCKET = "architecta-assets";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const limited = await enforceAiUsage(session.user.id, RATE_LIMITS.videoGenerate);
  if (limited) return limited;

  const body = await parseJsonBody<unknown>(req);
  const parsed = videoGenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid video input", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  if (input.postId) {
    const { data: ownerCheck, error: ownerErr } = await supabase
      .from("architecta_posts")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("id", input.postId)
      .maybeSingle();
    if (ownerErr) return apiError("server_error", ownerErr.message);
    if (!ownerCheck) return apiError("not_found", "Post not found");
  }

  const prefs = await getUserAiPreference(session.user.id);
  const model = input.model || prefs.openaiVideoModel || "sora-2";
  const assetId = crypto.randomUUID();

  // 1) Best-effort: try Sora.
  try {
    const video = await generateVideo({
      prompt: input.prompt,
      model,
      durationSeconds: input.durationSeconds,
    });

    const storagePath = `${session.user.id}/${assetId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(storagePath, video.bytes, {
        contentType: video.mimeType,
        upsert: false,
      });
    if (uploadError) {
      return apiError("server_error", `Storage upload failed: ${uploadError.message}`);
    }

    const { data: signed } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const { data: assetRow, error: insertError } = await supabase
      .from("architecta_generated_assets")
      .insert({
        id: assetId,
        user_id: session.user.id,
        workspace_id: input.workspaceId ?? null,
        post_id: input.postId ?? null,
        asset_type: "video",
        provider: video.provider,
        model: video.model,
        prompt: input.prompt,
        storage_bucket: ASSET_BUCKET,
        storage_path: storagePath,
        external_url: null,
        width: null,
        height: null,
        duration_seconds: video.durationSeconds,
        meta: {
          status: "ready",
          latency_ms: video.latencyMs,
          request_id: video.requestId,
        },
      })
      .select("*")
      .single();
    if (insertError) {
      await supabase.storage.from(ASSET_BUCKET).remove([storagePath]);
      return apiError("server_error", insertError.message);
    }

    if (input.postId) {
      await supabase
        .from("architecta_posts")
        .update({ video_asset_id: assetId })
        .eq("user_id", session.user.id)
        .eq("id", input.postId);
    }

    return apiOk({
      asset: {
        id: assetRow.id,
        assetType: "video" as const,
        status: "ready" as const,
        provider: assetRow.provider,
        model: assetRow.model,
        prompt: assetRow.prompt,
        storageBucket: assetRow.storage_bucket,
        storagePath: assetRow.storage_path,
        signedUrl: signed?.signedUrl ?? null,
        durationSeconds: assetRow.duration_seconds,
        postId: assetRow.post_id,
        createdAt: assetRow.created_at,
      },
    });
  } catch (err) {
    if (!(err instanceof VideoNotAvailableError)) {
      const message = err instanceof Error ? err.message : "Video generation failed";
      return apiError("upstream_error", message);
    }
    // Fall through to storyboard fallback.
  }

  // 2) Storyboard fallback via the text gateway.
  let storyboard: Storyboard;
  let storyboardProvider = "openai";
  let storyboardModel = "gpt-4o";
  try {
    const result = await runGateway({
      userId: session.user.id,
      workspaceId: input.workspaceId ?? null,
      task: "POST_GENERATION",
      prompt: buildStoryboardPrompt({
        prompt: input.prompt,
        model,
        durationSeconds: input.durationSeconds,
      }),
      maxTokens: 1500,
      temperature: 0.6,
      metadata: { intent: "video_storyboard_fallback" },
    });
    storyboard = extractJson<Storyboard>(result.text);
    storyboardProvider = result.provider;
    storyboardModel = result.model;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storyboard generation failed";
    return apiError("upstream_error", message);
  }

  const storagePath = `${session.user.id}/${assetId}.storyboard.json`;
  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, Buffer.from(JSON.stringify(storyboard, null, 2)), {
      contentType: "application/json",
      upsert: false,
    });
  if (uploadError) {
    return apiError("server_error", `Storage upload failed: ${uploadError.message}`);
  }

  const { data: signed } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const { data: assetRow, error: insertError } = await supabase
    .from("architecta_generated_assets")
    .insert({
      id: assetId,
      user_id: session.user.id,
      workspace_id: input.workspaceId ?? null,
      post_id: input.postId ?? null,
      asset_type: "video",
      provider: storyboardProvider,
      model: storyboardModel,
      prompt: input.prompt,
      storage_bucket: ASSET_BUCKET,
      storage_path: storagePath,
      external_url: null,
      width: null,
      height: null,
      duration_seconds: storyboard.totalDurationSeconds ?? input.durationSeconds,
      meta: {
        status: "storyboard",
        reason: "video_provider_unavailable",
        storyboard,
      },
    })
    .select("*")
    .single();
  if (insertError) {
    await supabase.storage.from(ASSET_BUCKET).remove([storagePath]);
    return apiError("server_error", insertError.message);
  }

  if (input.postId) {
    await supabase
      .from("architecta_posts")
      .update({ video_asset_id: assetId })
      .eq("user_id", session.user.id)
      .eq("id", input.postId);
  }

  return apiOk({
    asset: {
      id: assetRow.id,
      assetType: "video" as const,
      status: "storyboard" as const,
      provider: assetRow.provider,
      model: assetRow.model,
      prompt: assetRow.prompt,
      storageBucket: assetRow.storage_bucket,
      storagePath: assetRow.storage_path,
      signedUrl: signed?.signedUrl ?? null,
      durationSeconds: assetRow.duration_seconds,
      postId: assetRow.post_id,
      storyboard,
      createdAt: assetRow.created_at,
    },
  });
}
