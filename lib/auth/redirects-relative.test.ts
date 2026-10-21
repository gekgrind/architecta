import { describe, expect, it } from "vitest";

import {
  APP_HOME_PATH,
  isSafeRelativePath,
  sanitizeAuthRedirectPath,
  sanitizePostAuthRedirectPath,
} from "@/lib/auth/redirects";

/* Relative destinations a URL parser reads as another host. */
describe("relative redirect sanitizing", () => {
  const hostile = [
    "/\\evil.example",
    "/\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "//evil.example",
    "/\u0000/evil.example",
  ];

  for (const value of hostile) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(isSafeRelativePath(value)).toBe(false);
      expect(sanitizeAuthRedirectPath(value)).toBe(APP_HOME_PATH);
      expect(sanitizePostAuthRedirectPath(value)).toBe(APP_HOME_PATH);
    });
  }

  it("the browser really would leave the site for them", () => {
    expect(new URL("/\\evil.example", "https://architecta.entrepreneuria.io").host).toBe(
      "evil.example"
    );
    expect(new URL("/\t/evil.example", "https://architecta.entrepreneuria.io").host).toBe(
      "evil.example"
    );
  });

  for (const value of ["/calendar?tab=1", "/%0d/x", "/%5Cevil.example", "/a/b#c"]) {
    it(`keeps ${JSON.stringify(value)}, which stays a path`, () => {
      expect(isSafeRelativePath(value)).toBe(true);
      expect(sanitizeAuthRedirectPath(value)).toBe(value);
    });
  }
});
