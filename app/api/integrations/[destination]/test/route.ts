import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  DESTINATIONS_TABLE,
  getDecryptedCredentials,
  getDestinationRow,
  saveRefreshedCredentials,
  toIdentity,
} from "@/lib/integrations/connections";
import { getAdapter, isDestinationId } from "@/lib/integrations/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ destination: string }> };

/** Re-check a stored connection; powers the settings "Test" button. */
export async function POST(_req: Request, ctx: RouteContext) {
  const { destination } = await ctx.params;
  if (!isDestinationId(destination)) {
    return apiError("not_found", "Unknown destination");
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const adapter = getAdapter(destination);
  if (!adapter || !adapter.implemented) {
    return apiError("bad_request", `${destination} connections are not available yet`);
  }

  const row = await getDestinationRow(supabase, session.user.id, destination);
  if (!row) return apiError("not_found", `No ${destination} account connected`);

  const check = await adapter.validateConnection({
    credentials: getDecryptedCredentials(row),
    identity: toIdentity(row),
    onCredentialsRefreshed: async (next) => {
      await saveRefreshedCredentials(supabase, session.user.id, destination, next);
    },
  });

  // Keep the stored status honest so the settings list reflects reality.
  const nextStatus = check.ok ? "connected" : "error";
  if (nextStatus !== row.status) {
    await supabase
      .from(DESTINATIONS_TABLE)
      .update({ status: nextStatus })
      .eq("user_id", session.user.id)
      .eq("destination", destination);
  }

  return apiOk({ ok: check.ok, detail: check.detail });
}
