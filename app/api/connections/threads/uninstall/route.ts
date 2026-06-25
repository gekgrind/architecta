import { NextResponse } from "next/server";

import { CONNECTIONS_TABLE } from "@/lib/publishing/connections";
import { parseSignedRequest } from "@/lib/publishing/signed-request";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Threads "uninstall" (deauthorize) callback.
 *
 * Meta calls this server-to-server when a user removes the app from their
 * Threads account. There's no session — the request is authenticated by the
 * `signed_request` HMAC. We tear down the stored connection for that account.
 */
export async function POST(req: Request) {
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "Threads app not configured" },
      { status: 500 }
    );
  }

  const form = await req.formData().catch(() => null);
  const signedRequest = form?.get("signed_request");
  const payload = parseSignedRequest(
    typeof signedRequest === "string" ? signedRequest : null,
    appSecret
  );

  if (!payload?.user_id) {
    return NextResponse.json(
      { error: "Invalid signed_request" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServiceClient();
  const { error } = await supabase
    .from(CONNECTIONS_TABLE)
    .delete()
    .eq("platform", "threads")
    .eq("external_account_id", payload.user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
