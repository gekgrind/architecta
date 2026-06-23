import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ASSET_BUCKET = "architecta-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type AssetRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  post_id: string | null;
  asset_type: "image" | "video";
  provider: string;
  model: string;
  prompt: string;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");
  const assetType = searchParams.get("assetType");

  let query = supabase
    .from("architecta_generated_assets")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (postId) query = query.eq("post_id", postId);
  if (assetType === "image" || assetType === "video") {
    query = query.eq("asset_type", assetType);
  }

  const { data, error } = await query;
  if (error) return apiError("server_error", error.message);

  const rows = (data ?? []) as AssetRow[];
  const assets = await Promise.all(
    rows.map(async (row) => {
      let signedUrl: string | null = null;
      if (row.storage_path && row.storage_bucket) {
        const { data: signed } = await supabase.storage
          .from(row.storage_bucket)
          .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        postId: row.post_id,
        assetType: row.asset_type,
        provider: row.provider,
        model: row.model,
        prompt: row.prompt,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        externalUrl: row.external_url,
        signedUrl,
        width: row.width,
        height: row.height,
        durationSeconds: row.duration_seconds,
        meta: row.meta ?? {},
        createdAt: row.created_at,
      };
    })
  );

  return apiOk({ assets, bucket: ASSET_BUCKET });
}
