"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerUploadedAsset(input: {
  brandProfileId: string;
  storagePath: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("brand_assets").insert({
    user_id: user.id,
    brand_profile_id: input.brandProfileId,
    kind: "other",
    storage_path: input.storagePath,
    original_name: input.originalName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
