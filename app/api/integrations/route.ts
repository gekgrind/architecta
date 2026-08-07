import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  DESTINATIONS_TABLE,
  toDestinationSummary,
  type DestinationRow,
} from "@/lib/integrations/connections";
import { listDestinations } from "@/lib/integrations/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from(DESTINATIONS_TABLE)
    .select("*")
    .eq("user_id", session.user.id);

  if (error) return apiError("server_error", error.message);

  const byDestination = new Map(
    (data ?? []).map((row) => [
      (row as DestinationRow).destination,
      toDestinationSummary(row as DestinationRow),
    ])
  );

  // One entry per known destination, with the connection when present.
  const destinations = listDestinations().map((d) => ({
    ...d,
    connection: byDestination.get(d.destination) ?? null,
  }));

  return apiOk({ destinations });
}
