import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DESTINATIONS_TABLE,
  getDecryptedCredentials,
  getDestinationRow,
  redirectUriFor,
  toIdentity,
  upsertDestination,
} from "./connections";
import { getAdapter } from "./registry";
import type { DestinationId } from "./types";

/**
 * Connection lifecycle shared by every entry point: the generic
 * /api/integrations/[destination]/* routes and the provider-specific aliases
 * (e.g. /api/integrations/google/*) that exist because a provider's registered
 * redirect URI has to match byte-for-byte.
 */

/** Distinct from the social publishing state cookie so the flows can't collide. */
export const DESTINATION_STATE_COOKIE = "arch_destination_oauth_state";

function settingsRedirect(
  req: Request,
  result: "connected" | "error",
  destination: string
) {
  const base = process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ?? new URL(req.url).origin;
  const url = new URL("/settings", base.replace(/\/$/, ""));
  url.searchParams.set("destination", destination);
  url.searchParams.set("result", result);
  return NextResponse.redirect(url);
}

/**
 * Begin an OAuth connect: mint a CSRF nonce, stash it in an httpOnly cookie,
 * and redirect to the provider's consent screen.
 */
export async function startDestinationOAuth(
  destination: DestinationId
): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const adapter = getAdapter(destination);
  if (!adapter || !adapter.implemented) {
    return apiError("bad_request", `${destination} connections are not available yet`);
  }
  if (adapter.connectMethod !== "oauth" || !adapter.buildAuthUrl) {
    return apiError("bad_request", `${destination} connects with credentials, not OAuth`);
  }

  // CSRF: a random nonce echoed in an httpOnly cookie and the OAuth state param.
  const nonce = randomBytes(16).toString("hex");
  const state = `${destination}.${nonce}`;

  let authUrl: string;
  try {
    authUrl = adapter.buildAuthUrl({
      state,
      redirectUri: redirectUriFor(destination),
    });
  } catch (err) {
    return apiError(
      "server_error",
      err instanceof Error ? err.message : "Could not build authorization URL"
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(DESTINATION_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(authUrl);
}

/**
 * Revoke at the provider where supported, then drop the stored row. A provider
 * that refuses must not strand the user with a connection they can't remove.
 */
export async function disconnectDestination(
  destination: DestinationId
): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const adapter = getAdapter(destination);
  if (adapter) {
    try {
      const row = await getDestinationRow(supabase, session.user.id, destination);
      if (row) {
        await adapter.disconnect({
          credentials: getDecryptedCredentials(row),
          identity: toIdentity(row),
        });
      }
    } catch {
      // Fall through to the local delete.
    }
  }

  const { error } = await supabase
    .from(DESTINATIONS_TABLE)
    .delete()
    .eq("user_id", session.user.id)
    .eq("destination", destination);

  if (error) return apiError("server_error", error.message);

  return apiOk({ disconnected: true });
}

/**
 * Shared OAuth callback: validates the CSRF state cookie, exchanges the code,
 * and stores the encrypted credential. Reached from whichever path the
 * provider has registered as its redirect URI.
 */
export async function handleDestinationOAuthCallback(
  req: Request,
  destination: DestinationId
): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DESTINATION_STATE_COOKIE)?.value;
  // Consume the state cookie regardless of outcome.
  cookieStore.delete(DESTINATION_STATE_COOKIE);

  if (oauthError || !code) {
    return settingsRedirect(req, "error", destination);
  }
  if (!state || !expectedState || state !== expectedState) {
    return settingsRedirect(req, "error", destination);
  }

  const adapter = getAdapter(destination);
  if (!adapter || !adapter.implemented) {
    return settingsRedirect(req, "error", destination);
  }

  try {
    const connection = await adapter.connect({
      method: "oauth",
      code,
      state,
      redirectUri: redirectUriFor(destination),
    });
    await upsertDestination(supabase, session.user.id, {
      destination,
      identity: connection.identity,
      credentials: connection.credentials,
      scopes: connection.scopes,
      expiresAt: connection.expiresAt ?? null,
    });
  } catch {
    return settingsRedirect(req, "error", destination);
  }

  return settingsRedirect(req, "connected", destination);
}
