import { disconnectDestination } from "@/lib/integrations/oauth";

export const runtime = "nodejs";

/**
 * Revoke the Google token and delete the stored connection. Accepts POST and
 * DELETE so either verb works from the settings UI.
 */
export async function POST() {
  return disconnectDestination("gmail");
}

export async function DELETE() {
  return disconnectDestination("gmail");
}
