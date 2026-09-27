import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { createSupabaseRecorder } from "./supabase-recorder";

const h = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: h.createServerClient,
}));

import { middleware } from "@/middleware";

const USER_ID = "user-1";

function mockDb(options: { profile: Record<string, unknown>; sessionStatus: string | null }) {
  const db = createSupabaseRecorder({
    userId: USER_ID,
    tables: {
      profiles: { select: { data: options.profile, error: null } },
      onboarding_sessions: {
        select: {
          data: options.sessionStatus ? { status: options.sessionStatus } : null,
          error: null,
        },
      },
    },
  });
  h.createServerClient.mockReturnValue(db.client);
  return db;
}

function locationOf(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

const request = (path: string) => new NextRequest(new URL(path, "https://architecta.test"));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

describe("middleware onboarding gate", () => {
  it("sends an Entrepreneuria-onboarded user without an Architecta session to onboarding", async () => {
    mockDb({ profile: { id: USER_ID, onboarding_complete: true }, sessionStatus: null });

    const res = await middleware(request("/dashboard"));

    expect(locationOf(res)).toBe("/onboarding");
  });

  it("sends an in-progress Architecta user to onboarding despite the shared flag", async () => {
    mockDb({ profile: { id: USER_ID, onboarding_complete: true }, sessionStatus: "in_progress" });

    const res = await middleware(request("/calendar"));

    expect(locationOf(res)).toBe("/onboarding");
  });

  it("lets a completed Architecta user reach the dashboard even if the shared flag is false", async () => {
    mockDb({ profile: { id: USER_ID, onboarding_complete: false }, sessionStatus: "completed" });

    const res = await middleware(request("/dashboard"));

    expect(locationOf(res)).toBeNull();
  });

  it("moves a completed Architecta user off onboarding pages", async () => {
    mockDb({ profile: { id: USER_ID }, sessionStatus: "completed" });

    const res = await middleware(request("/onboarding/voice"));

    expect(locationOf(res)).toBe("/dashboard");
  });

  it("lets an incomplete Architecta user through to onboarding pages", async () => {
    mockDb({ profile: { id: USER_ID, onboarding_complete: true }, sessionStatus: "in_progress" });

    const res = await middleware(request("/onboarding/snapshot"));

    expect(locationOf(res)).toBeNull();
  });

  it("routes signed-in users on auth pages by Architecta completion", async () => {
    mockDb({ profile: { id: USER_ID, onboarding_complete: true }, sessionStatus: null });
    expect(locationOf(await middleware(request("/auth/login")))).toBe("/onboarding");

    mockDb({ profile: { id: USER_ID, onboarding_complete: false }, sessionStatus: "completed" });
    expect(locationOf(await middleware(request("/auth/login")))).toBe("/dashboard");
  });

  it("queries the architecta onboarding session for the signed-in user", async () => {
    const db = mockDb({ profile: { id: USER_ID }, sessionStatus: "completed" });

    await middleware(request("/dashboard"));

    expect(db.queries).toContainEqual(
      expect.objectContaining({
        table: "onboarding_sessions",
        filters: { user_id: USER_ID, app: "architecta" },
      })
    );
  });
});
