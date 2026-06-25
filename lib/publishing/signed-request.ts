import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta `signed_request` parsing + verification.
 *
 * Meta posts deauthorize ("uninstall") and data-deletion callbacks as a
 * `signed_request` form field shaped `"{signature}.{payload}"`, where both
 * halves are base64url. The signature is an HMAC-SHA256 of the *encoded payload
 * string* (the part after the dot) keyed with the app secret. The decoded
 * payload is JSON: `{ algorithm, issued_at, user_id }`.
 *
 * See: developers.facebook.com — "Parsing the signed request".
 */

export type SignedRequestPayload = {
  algorithm?: string;
  issued_at?: number;
  /** The platform-scoped user id (matches external_account_id on our row). */
  user_id?: string;
};

/**
 * Verify the HMAC and return the decoded payload, or `null` if the signature is
 * missing/malformed/invalid. Never throws on bad input — callers treat null as
 * "reject".
 */
export function parseSignedRequest(
  signedRequest: string | null | undefined,
  appSecret: string
): SignedRequestPayload | null {
  if (!signedRequest || !signedRequest.includes(".")) return null;

  const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
  if (!encodedSig || !encodedPayload) return null;

  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(encodedSig, "base64url");
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    return null;
  }

  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SignedRequestPayload;
    if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
