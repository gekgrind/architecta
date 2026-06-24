import { describe, expect, it } from "vitest";

import { apiError, apiOk } from "./response";

async function readJson(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("apiOk", () => {
  it("wraps data in a success envelope with 200", async () => {
    const res = apiOk({ hello: "world" });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toEqual({ ok: true, data: { hello: "world" } });
  });
});

describe("apiError", () => {
  it("maps each error code to the right HTTP status", () => {
    expect(apiError("bad_request", "x").status).toBe(400);
    expect(apiError("unauthorized", "x").status).toBe(401);
    expect(apiError("not_found", "x").status).toBe(404);
    expect(apiError("validation_error", "x").status).toBe(422);
    expect(apiError("rate_limited", "x").status).toBe(429);
    expect(apiError("upstream_error", "x").status).toBe(502);
    expect(apiError("server_error", "x").status).toBe(500);
  });

  it("includes the code, message and details in the body", async () => {
    const res = apiError("validation_error", "bad input", {
      details: { field: "topic" },
    });
    const body = await readJson(res);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "validation_error",
        message: "bad input",
        details: { field: "topic" },
      },
    });
  });

  it("honors a status override and forwards headers", () => {
    const res = apiError("rate_limited", "slow down", {
      headers: new Headers({ "Retry-After": "42" }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });
});
