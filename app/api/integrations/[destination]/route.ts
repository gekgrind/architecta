import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { upsertDestination } from "@/lib/integrations/connections";
import { disconnectDestination } from "@/lib/integrations/oauth";
import { getAdapter, isDestinationId } from "@/lib/integrations/registry";
import { DestinationConfigError } from "@/lib/integrations/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  brevoConnectSchema,
  customConnectSchema,
  ghostConnectSchema,
  wordpressConnectSchema,
} from "@/lib/validation/integrations";
import type { DestinationId } from "@/lib/integrations/types";
import type { ZodTypeAny } from "zod";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ destination: string }> };

/**
 * The connect form each credential-based destination posts. OAuth destinations
 * (Gmail, Outlook) are absent on purpose — they never reach this route.
 */
const CONNECT_SCHEMAS: Partial<Record<DestinationId, ZodTypeAny>> = {
  wordpress: wordpressConnectSchema,
  ghost: ghostConnectSchema,
  custom: customConnectSchema,
  brevo: brevoConnectSchema,
};

/** Connect a credential-based destination. OAuth ones go through /start. */
export async function POST(req: Request, ctx: RouteContext) {
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
  if (adapter.connectMethod !== "credentials") {
    return apiError(
      "bad_request",
      `Connect ${destination} through /api/integrations/${destination}/start`
    );
  }

  const schema = CONNECT_SCHEMAS[destination];
  if (!schema) {
    return apiError("bad_request", `${destination} connections are not available yet`);
  }

  const body = await parseJsonBody<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", `Invalid ${destination} connection details`, {
      details: { issues: parsed.error.flatten() },
    });
  }

  // Optional form fields arrive as undefined; adapters take a string map.
  const values = Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).filter(
      ([, value]) => typeof value === "string"
    )
  ) as Record<string, string>;

  try {
    const connection = await adapter.connect({ method: "credentials", values });
    await upsertDestination(supabase, session.user.id, {
      destination,
      identity: connection.identity,
      credentials: connection.credentials,
      scopes: connection.scopes,
      expiresAt: connection.expiresAt ?? null,
    });
    return apiOk({
      connected: true,
      externalAccountName: connection.identity.externalAccountName,
      config: connection.credentials.config,
    });
  } catch (err) {
    if (err instanceof DestinationConfigError) {
      return apiError("bad_request", err.message);
    }
    return apiError(
      "upstream_error",
      err instanceof Error ? err.message : "Could not connect that account"
    );
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { destination } = await ctx.params;
  if (!isDestinationId(destination)) {
    return apiError("not_found", "Unknown destination");
  }
  return disconnectDestination(destination);
}
