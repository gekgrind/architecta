import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { threadsAdapter } from "./threads";
import { PublishAuthError } from "./types";

const CTX = { accessToken: "tok", externalAccountId: "123", text: "hello" };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env.THREADS_APP_ID = "app";
  process.env.THREADS_APP_SECRET = "secret";
});
afterEach(() => vi.unstubAllGlobals());

describe("threadsAdapter.publish failures", () => {
  it("classifies an invalid/expired token (OAuthException 190) as an auth error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { message: "Session expired", code: 190 } }, 400))
    );
    await expect(threadsAdapter.publish(CTX)).rejects.toBeInstanceOf(PublishAuthError);
  });

  it("classifies HTTP 401 as an auth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { message: "nope" } }, 401)));
    await expect(threadsAdapter.publish(CTX)).rejects.toBeInstanceOf(PublishAuthError);
  });

  it("keeps other failures as HTTP errors carrying the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { message: "bad" } }, 400)));
    await expect(threadsAdapter.publish(CTX)).rejects.toMatchObject({
      name: "PublishHttpError",
      status: 400,
    });
  });

  it("still classifies a 401 with a non-JSON body as an auth error", async () => {
    // Some failure responses aren't valid JSON; parsing must not throw a raw
    // SyntaxError that hides the 401 from the reconnect classification.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Unauthorized</html>", { status: 401 }))
    );
    await expect(threadsAdapter.publish(CTX)).rejects.toBeInstanceOf(PublishAuthError);
  });
});
