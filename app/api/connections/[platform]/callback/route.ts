import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { logCallbackFailure, type CallbackStage } from "@/lib/publishing/diagnostics";
import { redirectUriFor, upsertConnection } from "@/lib/publishing/connections";
import { STATE_COOKIE } from "@/lib/publishing/oauth-state";
import { getAdapter, isPlatformId } from "@/lib/publishing/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ platform: string }> };

function settingsRedirect(req: Request, result: "connected" | "error", platform: string) {
  const base =
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ??
    new URL(req.url).origin;
  const url = new URL("/settings", base.replace(/\/$/, ""));
  url.searchParams.set("connection", platform);
  url.searchParams.set("result", result);
  return NextResponse.redirect(url);
}

export async function GET(req: Request, ctx: RouteContext) {
  const { platform } = await ctx.params;
  if (!isPlatformId(platform)) {
    return apiError("not_found", "Unknown platform");
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  // Consume the state cookie regardless of outcome.
  cookieStore.delete(STATE_COOKIE);

  if (oauthError || !code) {
    logCallbackFailure(platform, oauthError ? "provider_error" : "missing_code", {
      providerError: oauthError,
    });
    return settingsRedirect(req, "error", platform);
  }
  if (!state || !expectedState || state !== expectedState) {
    logCallbackFailure(platform, "state_mismatch");
    return settingsRedirect(req, "error", platform);
  }

  const adapter = getAdapter(platform);
  let stage: CallbackStage = "token_exchange";
  try {
    const redirectUri = redirectUriFor(platform);
    const tokens = await adapter.exchangeCode({ code, redirectUri, state });
    stage = "identity_lookup";
    const identity = await adapter.getAccountIdentity(tokens);
    stage = "save_connection";
    await upsertConnection(supabase, session.user.id, {
      platform,
      identity,
      tokens,
    });
  } catch (err) {
    logCallbackFailure(platform, stage, { err });
    return settingsRedirect(req, "error", platform);
  }

  return settingsRedirect(req, "connected", platform);
}
