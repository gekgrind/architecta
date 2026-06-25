import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseSignedRequest } from "./signed-request";

const SECRET = "test-threads-app-secret";

/** Build a valid Meta-style signed_request for the given payload. */
function sign(payload: Record<string, unknown>, secret = SECRET): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const sig = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${sig}.${encodedPayload}`;
}

describe("parseSignedRequest", () => {
  it("returns the payload for a valid signature", () => {
    const sr = sign({
      algorithm: "HMAC-SHA256",
      issued_at: 1700000000,
      user_id: "12345",
    });
    expect(parseSignedRequest(sr, SECRET)?.user_id).toBe("12345");
  });

  it("rejects a signature made with the wrong secret", () => {
    const sr = sign({ user_id: "12345" }, "attacker-secret");
    expect(parseSignedRequest(sr, SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const sr = sign({ user_id: "12345" });
    const [sig] = sr.split(".", 2);
    const forged = Buffer.from(JSON.stringify({ user_id: "99999" })).toString(
      "base64url"
    );
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it("rejects a non-HMAC-SHA256 algorithm", () => {
    const sr = sign({ algorithm: "PLAINTEXT", user_id: "12345" });
    expect(parseSignedRequest(sr, SECRET)).toBeNull();
  });

  it("returns null for missing / malformed input", () => {
    expect(parseSignedRequest(null, SECRET)).toBeNull();
    expect(parseSignedRequest("", SECRET)).toBeNull();
    expect(parseSignedRequest("no-dot-here", SECRET)).toBeNull();
  });
});
