import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { CONNECTIONS_TABLE } from "@/lib/publishing/connections";
import { parseSignedRequest } from "@/lib/publishing/signed-request";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function appBaseUrl(req: Request): string {
  const base =
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ?? new URL(req.url).origin;
  return base.replace(/\/$/, "");
}

/**
 * Threads data-deletion callback.
 *
 * Meta calls this server-to-server when a user requests deletion of their data.
 * We verify the `signed_request`, delete the stored connection (the only data
 * we hold for the Threads account), and return the JSON Meta requires:
 * `{ url, confirmation_code }` — a page the user can visit to confirm status.
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

  // A stable, non-guessable code derived from the account id — lets the status
  // page (and our logs) tie a confirmation back to the request without a table.
  const confirmationCode = createHmac("sha256", appSecret)
    .update(`threads:${payload.user_id}`)
    .digest("hex")
    .slice(0, 16);

  const url = `${appBaseUrl(req)}/connections/threads/deletion-status?code=${confirmationCode}`;

  return NextResponse.json({ url, confirmation_code: confirmationCode });
}
