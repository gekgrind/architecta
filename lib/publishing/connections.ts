import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptToken, encryptOptional, encryptToken } from "./crypto";
import type {
  AccountIdentity,
  OAuthTokens,
  PlatformId,
} from "./adapters/types";

export const CONNECTIONS_TABLE = "architecta_platform_connections";

export type ConnectionRow = {
  id: string;
  user_id: string;
  platform: string;
  external_account_id: string | null;
  external_account_name: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_iv: string | null;
  token_tag: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
  scopes: string[];
  expires_at: string | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/** UI-safe view of a connection — never includes token material. */
export function toConnectionSummary(row: ConnectionRow) {
  return {
    id: row.id,
    platform: row.platform,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    scopes: row.scopes ?? [],
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Decrypt the stored tokens for use in the publish path (server-only). */
export function getDecryptedTokens(row: ConnectionRow): {
  accessToken: string;
  refreshToken: string | null;
} {
  if (!row.access_token_enc || !row.token_iv || !row.token_tag) {
    throw new Error("Connection has no stored access token");
  }
  const accessToken = decryptToken({
    cipher: row.access_token_enc,
    iv: row.token_iv,
    tag: row.token_tag,
  });
  let refreshToken: string | null = null;
  if (row.refresh_token_enc && row.refresh_token_iv && row.refresh_token_tag) {
    refreshToken = decryptToken({
      cipher: row.refresh_token_enc,
      iv: row.refresh_token_iv,
      tag: row.refresh_token_tag,
    });
  }
  return { accessToken, refreshToken };
}

/** Build the OAuth redirect URI that must be registered with the provider. */
export function redirectUriFor(platform: PlatformId): string {
  const base =
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/connections/${platform}/callback`;
}

/** Encrypt tokens + upsert the connection row (keyed on user+platform). */
export async function upsertConnection(
  supabase: SupabaseClient,
  userId: string,
  args: {
    platform: PlatformId;
    identity: AccountIdentity;
    tokens: OAuthTokens;
  }
) {
  const access = encryptToken(args.tokens.accessToken);
  const refresh = encryptOptional(args.tokens.refreshToken);

  const { error } = await supabase.from(CONNECTIONS_TABLE).upsert(
    {
      user_id: userId,
      platform: args.platform,
      external_account_id: args.identity.externalAccountId,
      external_account_name: args.identity.externalAccountName,
      access_token_enc: access.cipher,
      token_iv: access.iv,
      token_tag: access.tag,
      refresh_token_enc: refresh.cipher,
      refresh_token_iv: refresh.iv,
      refresh_token_tag: refresh.tag,
      scopes: args.tokens.scopes,
      expires_at: args.tokens.expiresAt ?? null,
      status: "connected",
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    throw new Error(`Failed to save connection: ${error.message}`);
  }
}
