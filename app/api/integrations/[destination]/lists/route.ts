import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { listBrevoLists } from "@/lib/integrations/email/brevo";
import {
  getDecryptedCredentials,
  getDestinationRow,
} from "@/lib/integrations/connections";
import { isDestinationId } from "@/lib/integrations/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ destination: string }> };

/**
 * The audiences a destination can send to. Only Brevo has any: its campaigns
 * address a consented contact list rather than typed addresses, and nobody
 * knows their own list ids by heart.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const { destination } = await ctx.params;
  if (!isDestinationId(destination)) {
    return apiError("not_found", "Unknown destination");
  }
  if (destination !== "brevo") {
    return apiError("bad_request", `${destination} doesn't send to saved lists`);
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const row = await getDestinationRow(supabase, session.user.id, destination);
  if (!row) return apiError("not_found", "No Brevo account connected");

  try {
    const lists = await listBrevoLists(getDecryptedCredentials(row));
    return apiOk({ lists });
  } catch (err) {
    return apiError(
      "upstream_error",
      err instanceof Error ? err.message : "Could not load Brevo lists"
    );
  }
}
