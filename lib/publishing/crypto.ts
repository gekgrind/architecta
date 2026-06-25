import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * App-level token encryption for stored OAuth credentials.
 *
 * AES-256-GCM. The key comes from PLATFORM_TOKEN_ENC_KEY (kept alongside the
 * service-role key, never shipped to the client). Even if an attacker reads a
 * connection row, the token columns are ciphertext and useless without the key.
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.PLATFORM_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error("Missing PLATFORM_TOKEN_ENC_KEY");
  }
  // Accept any-length secret; derive a stable 32-byte key via SHA-256 so the
  // operator doesn't have to produce exactly-32-byte material.
  return createHash("sha256").update(raw).digest();
}

export type EncryptedToken = {
  cipher: string; // base64 ciphertext
  iv: string; // base64 iv
  tag: string; // base64 auth tag
};

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptToken(parts: EncryptedToken): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(parts.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parts.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(parts.cipher, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Encrypt an optional token; returns nulls when there's nothing to store. */
export function encryptOptional(
  plaintext: string | null | undefined
): { cipher: string | null; iv: string | null; tag: string | null } {
  if (!plaintext) return { cipher: null, iv: null, tag: null };
  const e = encryptToken(plaintext);
  return { cipher: e.cipher, iv: e.iv, tag: e.tag };
}
