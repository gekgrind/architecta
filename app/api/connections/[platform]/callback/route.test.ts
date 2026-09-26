import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  exchangeCode: vi.fn(),
  getAccountIdentity: vi.fn(),
  upsertConnection: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: h.cookieGet, delete: h.cookieDelete }),
}));
vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/publishing/connections", () => ({
  redirectUriFor: () => "https://app.example/cb",
  upsertConnection: h.upsertConnection,
}));
vi.mock("@/lib/publishing/registry", () => ({
  isPlatformId: (p: string) => p === "linkedin",
  getAdapter: () => ({
    exchangeCode: h.exchangeCode,
    getAccountIdentity: h.getAccountIdentity,
  }),
}));

import { GET } from "./route";

const CODE = "auth-code-SECRET";
const STATE = "state-SECRET";
const ctx = { params: Promise.resolve({ platform: "linkedin" }) };
const callback = (qs: string) => new Request(`https://app.example/api/connections/linkedin/callback?${qs}`);

let logged: string;

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset());
  logged = "";
  vi.spyOn(console, "error").mockImplementation((...args) => {
    logged += args.join(" ") + "\n";
  });
  h.createSupabaseServerClient.mockResolvedValue({});
  h.getAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
  h.cookieGet.mockReturnValue({ value: STATE });
});

describe("GET /api/connections/[platform]/callback", () => {
  it("connects and redirects with result=connected on success", async () => {
    h.exchangeCode.mockResolvedValue({ accessToken: "a", scopes: [] });
    h.getAccountIdentity.mockResolvedValue({ externalAccountId: "1", externalAccountName: "n" });
    const res = await GET(callback(`code=${CODE}&state=${STATE}`), ctx);
    expect(res.headers.get("location")).toContain("result=connected");
    expect(h.upsertConnection).toHaveBeenCalledOnce();
    expect(logged).toBe("");
    // Must match the cookie the start route sets.
    expect(h.cookieGet).toHaveBeenCalledWith("arch_oauth_state");
    expect(h.cookieDelete).toHaveBeenCalledWith("arch_oauth_state");
  });

  it("logs the failing stage and status, without secrets, when token exchange fails", async () => {
    h.exchangeCode.mockRejectedValue(
      new Error(`LinkedIn token exchange failed (401) code=${CODE} client_secret=shh`)
    );
    const res = await GET(callback(`code=${CODE}&state=${STATE}`), ctx);
    expect(res.headers.get("location")).toContain("result=error");
    const entry = JSON.parse(logged.trim());
    expect(entry).toMatchObject({
      scope: "oauth_callback",
      platform: "linkedin",
      stage: "token_exchange",
      errorClass: "http",
      httpStatus: 401,
    });
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain(STATE);
    expect(logged).not.toContain("shh");
  });

  it("reports the identity_lookup and save_connection stages", async () => {
    h.exchangeCode.mockResolvedValue({ accessToken: "a", scopes: [] });
    h.getAccountIdentity.mockRejectedValue(new Error("boom"));
    await GET(callback(`code=${CODE}&state=${STATE}`), ctx);
    expect(JSON.parse(logged.trim()).stage).toBe("identity_lookup");

    logged = "";
    h.getAccountIdentity.mockResolvedValue({ externalAccountId: "1", externalAccountName: null });
    h.upsertConnection.mockRejectedValue(new Error("Failed to save connection: nope"));
    await GET(callback(`code=${CODE}&state=${STATE}`), ctx);
    expect(JSON.parse(logged.trim()).stage).toBe("save_connection");
  });

  it("logs provider errors and state mismatches", async () => {
    let res = await GET(callback("error=access_denied&error_description=user+said+no"), ctx);
    expect(res.headers.get("location")).toContain("result=error");
    expect(JSON.parse(logged.trim())).toMatchObject({
      stage: "provider_error",
      providerError: "access_denied",
    });

    logged = "";
    res = await GET(callback(`code=${CODE}&state=other`), ctx);
    expect(res.headers.get("location")).toContain("result=error");
    expect(JSON.parse(logged.trim()).stage).toBe("state_mismatch");
    expect(logged).not.toContain(CODE);
    expect(h.exchangeCode).not.toHaveBeenCalled();
  });
});
