"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerUploadedAsset } from "@/lib/onboarding/actions-assets";

type VisualUploadProps = {
  brandProfileId: string;
  userId: string;
};

export default function VisualUpload({ brandProfileId, userId }: VisualUploadProps) {
  const supabase = createSupabaseBrowserClient();
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const path = `${userId}/${brandProfileId}/${crypto.randomUUID()}-${file.name}`;

    const { error: upErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, file, { contentType: file.type });

    if (!upErr) {
      await registerUploadedAsset({
        brandProfileId,
        storagePath: path,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    }

    setUploading(false);
  }

  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <label className="text-sm text-slate-300">Upload brand visuals</label>
      <input className="mt-2" type="file" onChange={onFile} />
      {uploading && <p className="text-xs text-slate-400 mt-2">Uploading…</p>}
    </div>
  );
}
