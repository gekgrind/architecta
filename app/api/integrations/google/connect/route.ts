import { startDestinationOAuth } from "@/lib/integrations/oauth";

export const runtime = "nodejs";

/**
 * Start the Google OAuth consent flow for the Gmail destination.
 *
 * Google's OAuth client for this integration is registered under a `google`
 * callback path, so its connect/callback/disconnect endpoints live here rather
 * than under the generic /api/integrations/[destination]/* routes. Both reach
 * the same shared implementation.
 */
export async function GET() {
  return startDestinationOAuth("gmail");
}
