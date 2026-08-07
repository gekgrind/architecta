import { handleDestinationOAuthCallback } from "@/lib/integrations/oauth";

export const runtime = "nodejs";

/**
 * Google's registered redirect URI (GOOGLE_INTEGRATION_REDIRECT_URI) points
 * here. Google requires a byte-for-byte match, so this path is fixed by the
 * OAuth client's configuration, not by our destination naming.
 */
export async function GET(req: Request) {
  return handleDestinationOAuthCallback(req, "gmail");
}
