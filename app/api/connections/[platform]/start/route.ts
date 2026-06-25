import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { redirectUriFor } from "@/lib/publishing/connections";
import { getAdapter, isPlatformId } from "@/lib/publishing/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ platform: string }> };

export const STATE_COOKIE = "arch_oauth_state";

export async function GET(_req: Request, ctx: RouteContext) {
  const { platform } = await ctx.params;
  if (!isPlatformId(platform)) {
    return apiError("not_found", "Unknown platform");
  }

  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const adapter = getAdapter(platform);
  if (!adapter.implemented) {
    return apiError("bad_request", `${platform} connections are not available yet`);
  }

  // CSRF: a random nonce echoed in an httpOnly cookie and the OAuth state param.
  const nonce = randomBytes(16).toString("hex");
  const state = `${platform}.${nonce}`;

  let authUrl: string;
  try {
    authUrl = adapter.buildAuthUrl({ state, redirectUri: redirectUriFor(platform) });
  } catch (err) {
    return apiError(
      "server_error",
      err instanceof Error ? err.message : "Could not build authorization URL"
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(authUrl);
}
