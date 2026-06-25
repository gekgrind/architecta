import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { redirectUriFor, upsertConnection } from "@/lib/publishing/connections";
import { getAdapter, isPlatformId } from "@/lib/publishing/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STATE_COOKIE } from "../start/route";

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
    return settingsRedirect(req, "error", platform);
  }
  if (!state || !expectedState || state !== expectedState) {
    return settingsRedirect(req, "error", platform);
  }

  const adapter = getAdapter(platform);
  try {
    const redirectUri = redirectUriFor(platform);
    const tokens = await adapter.exchangeCode({ code, redirectUri });
    const identity = await adapter.getAccountIdentity(tokens);
    await upsertConnection(supabase, session.user.id, {
      platform,
      identity,
      tokens,
    });
  } catch {
    return settingsRedirect(req, "error", platform);
  }

  return settingsRedirect(req, "connected", platform);
}
