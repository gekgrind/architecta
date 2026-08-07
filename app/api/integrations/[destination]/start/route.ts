import { apiError } from "@/lib/api/response";
import { startDestinationOAuth } from "@/lib/integrations/oauth";
import { isDestinationId } from "@/lib/integrations/registry";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ destination: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { destination } = await ctx.params;
  if (!isDestinationId(destination)) {
    return apiError("not_found", "Unknown destination");
  }
  return startDestinationOAuth(destination);
}
