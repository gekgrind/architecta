import "server-only";

import { createHash, createHmac } from "node:crypto";

/**
 * OAuth 2.0 PKCE (RFC 7636) helpers for adapters whose provider requires it
 * (X, TikTok). The verifier is derived deterministically from the OAuth
 * `state` + the app's client secret via HMAC-SHA256, so it never needs to be
 * persisted between the `/start` redirect and the `/callback` exchange — the
 * existing state cookie round-trip is enough. An attacker who observes
 * `state` and the resulting `code_challenge` still can't reproduce the
 * verifier without the client secret.
 */
export function deriveCodeVerifier(state: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(state).digest("base64url");
}

export function codeChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
