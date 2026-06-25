import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptToken, encryptOptional, encryptToken } from "./crypto";

const PREV = process.env.PLATFORM_TOKEN_ENC_KEY;

beforeAll(() => {
  process.env.PLATFORM_TOKEN_ENC_KEY = "test-encryption-key-for-vitest-only";
});
afterAll(() => {
  process.env.PLATFORM_TOKEN_ENC_KEY = PREV;
});

describe("token crypto", () => {
  it("round-trips a token", () => {
    const token = "ya29.super-secret-access-token";
    const enc = encryptToken(token);
    expect(enc.cipher).not.toContain(token);
    expect(decryptToken(enc)).toBe(token);
  });

  it("produces a fresh iv each time (non-deterministic ciphertext)", () => {
    const a = encryptToken("same");
    const b = encryptToken("same");
    expect(a.cipher).not.toBe(b.cipher);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails to decrypt when the auth tag is wrong", () => {
    const enc = encryptToken("tampered");
    expect(() => decryptToken({ ...enc, tag: Buffer.from("0".repeat(16)).toString("base64") })).toThrow();
  });

  it("encryptOptional returns nulls for empty input", () => {
    expect(encryptOptional(null)).toEqual({ cipher: null, iv: null, tag: null });
    expect(encryptOptional(undefined)).toEqual({ cipher: null, iv: null, tag: null });
  });

  it("encryptOptional round-trips a present token", () => {
    const e = encryptOptional("refresh-xyz");
    expect(e.cipher).not.toBeNull();
    expect(
      decryptToken({ cipher: e.cipher!, iv: e.iv!, tag: e.tag! })
    ).toBe("refresh-xyz");
  });

  it("throws when the key env var is missing", () => {
    const saved = process.env.PLATFORM_TOKEN_ENC_KEY;
    delete process.env.PLATFORM_TOKEN_ENC_KEY;
    try {
      expect(() => encryptToken("x")).toThrow(/PLATFORM_TOKEN_ENC_KEY/);
    } finally {
      process.env.PLATFORM_TOKEN_ENC_KEY = saved;
    }
  });
});
