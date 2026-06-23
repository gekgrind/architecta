import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { generateImage } from "@/lib/ai/llm/providers/openai-images";
import { getUserAiPreference } from "@/lib/ai/llm/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { imageGenerateInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const ASSET_BUCKET = "architecta-assets";

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = imageGenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid image input", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  const prefs = await getUserAiPreference(session.user.id);
  const model = input.model || prefs.openaiImageModel || "gpt-image-1";

  // If a postId was provided, make sure the post belongs to this user before
  // we burn an image-gen credit.
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

  let generated;
  try {
    generated = await generateImage({
      prompt: input.prompt,
      model,
      size: input.size,
      quality: input.quality,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return apiError("upstream_error", message);
  }

  const assetId = crypto.randomUUID();
  const storagePath = `${session.user.id}/${assetId}.png`;

  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, base64ToBuffer(generated.base64), {
      contentType: generated.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return apiError("server_error", `Storage upload failed: ${uploadError.message}`);
  }

  const { data: signedUrl } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

  const { data: assetRow, error: insertError } = await supabase
    .from("architecta_generated_assets")
    .insert({
      id: assetId,
      user_id: session.user.id,
      workspace_id: input.workspaceId ?? null,
      post_id: input.postId ?? null,
      asset_type: "image",
      provider: generated.provider,
      model: generated.model,
      prompt: input.prompt,
      storage_bucket: ASSET_BUCKET,
      storage_path: storagePath,
      external_url: null,
      width: generated.width,
      height: generated.height,
      duration_seconds: null,
      meta: {
        size: input.size,
        quality: input.quality,
        latency_ms: generated.latencyMs,
        request_id: generated.requestId,
      },
    })
    .select("*")
    .single();

  if (insertError) {
    // Best-effort cleanup of the uploaded object.
    await supabase.storage.from(ASSET_BUCKET).remove([storagePath]);
    return apiError("server_error", insertError.message);
  }

  if (input.postId) {
    await supabase
      .from("architecta_posts")
      .update({ image_asset_id: assetId })
      .eq("user_id", session.user.id)
      .eq("id", input.postId);
  }

  return apiOk({
    asset: {
      id: assetRow.id,
      assetType: "image" as const,
      provider: assetRow.provider,
      model: assetRow.model,
      prompt: assetRow.prompt,
      storageBucket: assetRow.storage_bucket,
      storagePath: assetRow.storage_path,
      signedUrl: signedUrl?.signedUrl ?? null,
      width: assetRow.width,
      height: assetRow.height,
      postId: assetRow.post_id,
      createdAt: assetRow.created_at,
    },
  });
}
