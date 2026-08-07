import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Reuses the app's existing AES-256-GCM credential encryption (keyed on
// PLATFORM_TOKEN_ENC_KEY) rather than inventing a second scheme.
import { decryptToken, encryptOptional, encryptToken } from "@/lib/publishing/crypto";
import type {
  DestinationCredentials,
  DestinationId,
  DestinationIdentity,
} from "./types";

export const DESTINATIONS_TABLE = "architecta_content_destinations";

export type DestinationRow = {
  id: string;
  user_id: string;
  destination: string;
  external_account_id: string | null;
  external_account_name: string | null;
  secret_enc: string | null;
  secret_iv: string | null;
  secret_tag: string | null;
  refresh_secret_enc: string | null;
  refresh_secret_iv: string | null;
  refresh_secret_tag: string | null;
  /** Non-secret connection config only (site URL, username, sender address). */
  config: Record<string, string> | null;
  scopes: string[];
  expires_at: string | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/** UI-safe view of a connection — never includes secret material. */
export function toDestinationSummary(row: DestinationRow) {
  return {
    id: row.id,
    destination: row.destination,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    // `config` is non-secret by construction; adapters put secrets in secret_enc.
    config: row.config ?? {},
    scopes: row.scopes ?? [],
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type DestinationSummary = ReturnType<typeof toDestinationSummary>;

/** Decrypt the stored credentials for adapter use (server-only). */
export function getDecryptedCredentials(row: DestinationRow): DestinationCredentials {
  if (!row.secret_enc || !row.secret_iv || !row.secret_tag) {
    throw new Error("Connection has no stored credential");
  }
  const secret = decryptToken({
    cipher: row.secret_enc,
    iv: row.secret_iv,
    tag: row.secret_tag,
  });
  let refreshSecret: string | null = null;
  if (row.refresh_secret_enc && row.refresh_secret_iv && row.refresh_secret_tag) {
    refreshSecret = decryptToken({
      cipher: row.refresh_secret_enc,
      iv: row.refresh_secret_iv,
      tag: row.refresh_secret_tag,
    });
  }
  return {
    secret,
    refreshSecret,
    expiresAt: row.expires_at,
    config: row.config ?? {},
  };
}

/**
 * Persist a credential an adapter refreshed mid-call. Providers that rotate
 * refresh tokens send a new one; those that don't leave the stored one alone.
 */
export async function saveRefreshedCredentials(
  supabase: SupabaseClient,
  userId: string,
  destination: DestinationId,
  next: {
    secret: string;
    refreshSecret?: string | null;
    expiresAt?: string | null;
  }
): Promise<void> {
  const secret = encryptToken(next.secret);
  const patch: Record<string, unknown> = {
    secret_enc: secret.cipher,
    secret_iv: secret.iv,
    secret_tag: secret.tag,
    expires_at: next.expiresAt ?? null,
    status: "connected",
  };

  if (next.refreshSecret) {
    const refresh = encryptToken(next.refreshSecret);
    patch.refresh_secret_enc = refresh.cipher;
    patch.refresh_secret_iv = refresh.iv;
    patch.refresh_secret_tag = refresh.tag;
  }

  await supabase
    .from(DESTINATIONS_TABLE)
    .update(patch)
    .eq("user_id", userId)
    .eq("destination", destination);
}

/** Flag a connection the provider has stopped honouring. */
export async function markDestinationStatus(
  supabase: SupabaseClient,
  userId: string,
  destination: DestinationId,
  status: "connected" | "expired" | "revoked" | "error"
): Promise<void> {
  await supabase
    .from(DESTINATIONS_TABLE)
    .update({ status })
    .eq("user_id", userId)
    .eq("destination", destination);
}

export function toIdentity(row: DestinationRow): DestinationIdentity {
  return {
    externalAccountId: row.external_account_id ?? "",
    externalAccountName: row.external_account_name,
  };
}

/**
 * OAuth redirect URI that must be registered with the provider, byte-for-byte.
 *
 * Gmail rides on a dedicated Google OAuth client whose registered callback is
 * configured explicitly (GOOGLE_INTEGRATION_REDIRECT_URI), and its path says
 * `google` rather than `gmail` — one Google client, one callback, currently
 * serving the Gmail destination. Google rejects any mismatch, so the
 * configured value always wins over the derived default.
 *
 * Outlook's registered callback (MICROSOFT_REDIRECT_URI) normally *is* the
 * derived default, but Entra ID matches just as strictly, so it stays
 * overridable for deployments on another host.
 */
export function redirectUriFor(destination: DestinationId): string {
  if (destination === "gmail" && process.env.GOOGLE_INTEGRATION_REDIRECT_URI) {
    return process.env.GOOGLE_INTEGRATION_REDIRECT_URI;
  }
  if (destination === "microsoft" && process.env.MICROSOFT_REDIRECT_URI) {
    return process.env.MICROSOFT_REDIRECT_URI;
  }
  const base =
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/integrations/${destination}/callback`;
}

/** Encrypt credentials + upsert the row (keyed on user+destination). */
export async function upsertDestination(
  supabase: SupabaseClient,
  userId: string,
  args: {
    destination: DestinationId;
    identity: DestinationIdentity;
    credentials: DestinationCredentials;
    scopes: string[];
    expiresAt?: string | null;
  }
) {
  const secret = encryptToken(args.credentials.secret);
  const refresh = encryptOptional(args.credentials.refreshSecret);

  const { error } = await supabase.from(DESTINATIONS_TABLE).upsert(
    {
      user_id: userId,
      destination: args.destination,
      external_account_id: args.identity.externalAccountId,
      external_account_name: args.identity.externalAccountName,
      secret_enc: secret.cipher,
      secret_iv: secret.iv,
      secret_tag: secret.tag,
      refresh_secret_enc: refresh.cipher,
      refresh_secret_iv: refresh.iv,
      refresh_secret_tag: refresh.tag,
      config: args.credentials.config,
      scopes: args.scopes,
      expires_at: args.expiresAt ?? null,
      status: "connected",
    },
    { onConflict: "user_id,destination" }
  );

  if (error) {
    throw new Error(`Failed to save connection: ${error.message}`);
  }
}

/** Load a single connection row for the signed-in user. */
export async function getDestinationRow(
  supabase: SupabaseClient,
  userId: string,
  destination: DestinationId
): Promise<DestinationRow | null> {
  const { data, error } = await supabase
    .from(DESTINATIONS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("destination", destination)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DestinationRow | null) ?? null;
}
