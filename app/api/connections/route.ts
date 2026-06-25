import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  CONNECTIONS_TABLE,
  toConnectionSummary,
  type ConnectionRow,
} from "@/lib/publishing/connections";
import { listConnectablePlatforms } from "@/lib/publishing/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select("*")
    .eq("user_id", session.user.id);

  if (error) return apiError("server_error", error.message);

  const byPlatform = new Map(
    (data ?? []).map((row) => [
      (row as ConnectionRow).platform,
      toConnectionSummary(row as ConnectionRow),
    ])
  );

  // One entry per supported platform, with the connection if present.
  const platforms = listConnectablePlatforms().map((p) => ({
    platform: p.platform,
    implemented: p.implemented,
    connection: byPlatform.get(p.platform) ?? null,
  }));

  return apiOk({ platforms });
}
