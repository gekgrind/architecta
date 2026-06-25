import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { CONNECTIONS_TABLE } from "@/lib/publishing/connections";
import { isPlatformId } from "@/lib/publishing/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ platform: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { platform } = await ctx.params;
  if (!isPlatformId(platform)) {
    return apiError("not_found", "Unknown platform");
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { error } = await supabase
    .from(CONNECTIONS_TABLE)
    .delete()
    .eq("user_id", session.user.id)
    .eq("platform", platform);

  if (error) return apiError("server_error", error.message);

  return apiOk({ disconnected: true });
}
