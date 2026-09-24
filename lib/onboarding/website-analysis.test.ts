import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  runGateway: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));

import { isUnsafeUrl } from "./website-analysis";

/* =======================================================
   SSRF Protection
======================================================= */

describe("isUnsafeUrl", () => {
  it("rejects localhost", () => {
    expect(isUnsafeUrl("http://localhost/foo")).not.toBeNull();
  });

  it("rejects 127.0.0.1", () => {
    expect(isUnsafeUrl("http://127.0.0.1/")).not.toBeNull();
  });

  it("rejects 0.0.0.0", () => {
    expect(isUnsafeUrl("http://0.0.0.0/")).not.toBeNull();
  });

  it("rejects private 10.x range", () => {
    expect(isUnsafeUrl("http://10.0.0.1/admin")).not.toBeNull();
  });

  it("rejects private 172.16.x range", () => {
    expect(isUnsafeUrl("http://172.16.0.1/")).not.toBeNull();
  });

  it("rejects private 192.168.x range", () => {
    expect(isUnsafeUrl("http://192.168.1.1/")).not.toBeNull();
  });

  it("rejects link-local 169.254.x range", () => {
    expect(isUnsafeUrl("http://169.254.169.254/latest/meta-data")).not.toBeNull();
  });

  it("rejects metadata.google.internal", () => {
    expect(isUnsafeUrl("http://metadata.google.internal/")).not.toBeNull();
  });

  it("rejects IPv6 loopback", () => {
    expect(isUnsafeUrl("http://[::1]/")).not.toBeNull();
  });

  it("rejects fe80 link-local IPv6", () => {
    expect(isUnsafeUrl("http://[fe80::1]/")).not.toBeNull();
  });

  it("rejects ftp protocol", () => {
    expect(isUnsafeUrl("ftp://example.com/file")).not.toBeNull();
  });

  it("rejects file protocol", () => {
    expect(isUnsafeUrl("file:///etc/passwd")).not.toBeNull();
  });

  it("rejects URLs with credentials", () => {
    expect(isUnsafeUrl("http://admin:pass@example.com/")).not.toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(isUnsafeUrl("not-a-url")).not.toBeNull();
  });

  it("allows valid public URLs", () => {
    expect(isUnsafeUrl("https://example.com")).toBeNull();
  });

  it("allows valid public URLs with paths", () => {
    expect(isUnsafeUrl("https://www.entrepreneuria.io/about")).toBeNull();
  });

  it("allows http protocol", () => {
    expect(isUnsafeUrl("http://example.com")).toBeNull();
  });

  it("rejects mapped IPv4 in IPv6", () => {
    expect(isUnsafeUrl("http://[::ffff:127.0.0.1]/")).not.toBeNull();
    expect(isUnsafeUrl("http://[::ffff:10.0.0.1]/")).not.toBeNull();
    expect(isUnsafeUrl("http://[::ffff:192.168.1.1]/")).not.toBeNull();
  });
});

/* =======================================================
   Website Analysis Integration
======================================================= */

describe("analyzeWebsite", () => {
  it("is exported as a function", async () => {
    const { analyzeWebsite } = await import("./website-analysis");
    expect(typeof analyzeWebsite).toBe("function");
  });
});

/* =======================================================
   No references to prospra_brand_profiles
======================================================= */

describe("dead code removal", () => {
  it("actions.ts does not reference prospra_brand_profiles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsContent = fs.readFileSync(
      path.resolve(__dirname, "./actions.ts"),
      "utf-8"
    );
    expect(actionsContent).not.toContain("prospra_brand_profiles");
  });

  it("persistence.ts does not reference prospra_brand_profiles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "./persistence.ts"),
      "utf-8"
    );
    expect(content).not.toContain("prospra_brand_profiles");
  });

  it("actions.ts does not export importFromProspra", async () => {
    const actions = await import("./actions");
    expect("importFromProspra" in actions).toBe(false);
  });
});
