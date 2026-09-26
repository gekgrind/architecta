import { describe, expect, it } from "vitest";

import { createSupabaseRecorder } from "@/test/onboarding/supabase-recorder";
import {
  fetchArchitectaOnboardingComplete,
  isArchitectaOnboardingComplete,
  resolveOnboardingStepAccess,
} from "./gate";
import { getFurthestStep } from "./steps";

type GateClient = Parameters<typeof fetchArchitectaOnboardingComplete>[0];
const asClient = (db: ReturnType<typeof createSupabaseRecorder>) =>
  db.client as unknown as GateClient;

describe("isArchitectaOnboardingComplete", () => {
  it("is true only for a completed Architecta session", () => {
    expect(isArchitectaOnboardingComplete({ status: "completed" })).toBe(true);
    expect(isArchitectaOnboardingComplete({ status: "in_progress" })).toBe(false);
    expect(isArchitectaOnboardingComplete({ status: null })).toBe(false);
    expect(isArchitectaOnboardingComplete(null)).toBe(false);
  });
});

describe("fetchArchitectaOnboardingComplete", () => {
  it("reads the architecta onboarding session, not the shared profile flag", async () => {
    const db = createSupabaseRecorder({
      userId: "u1",
      tables: {
        profiles: { select: { data: { onboarding_complete: true }, error: null } },
        onboarding_sessions: { select: { data: null, error: null } },
      },
    });

    await expect(fetchArchitectaOnboardingComplete(asClient(db), "u1")).resolves.toBe(false);
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0]).toMatchObject({
      table: "onboarding_sessions",
      filters: { user_id: "u1", app: "architecta" },
    });
  });

  it("is true when the architecta session is completed", async () => {
    const db = createSupabaseRecorder({
      userId: "u1",
      tables: { onboarding_sessions: { select: { data: { status: "completed" }, error: null } } },
    });

    await expect(fetchArchitectaOnboardingComplete(asClient(db), "u1")).resolves.toBe(true);
  });

  it("fails closed on a read error", async () => {
    const db = createSupabaseRecorder({
      userId: "u1",
      tables: {
        onboarding_sessions: { select: { data: { status: "completed" }, error: { message: "boom" } } },
      },
    });

    await expect(fetchArchitectaOnboardingComplete(asClient(db), "u1")).resolves.toBe(false);
  });
});

describe("resolveOnboardingStepAccess (current step = foundation, step 6)", () => {
  const session = {
    status: "in_progress",
    current_step: "foundation",
    completed_steps: ["welcome", "source", "website", "snapshot", "market", "customers"],
  };

  it("renders the current step", () => {
    expect(resolveOnboardingStepAccess("foundation", session)).toEqual({ kind: "render" });
  });

  it("renders the previous step", () => {
    expect(resolveOnboardingStepAccess("customers", session)).toEqual({ kind: "render" });
  });

  it("renders a much earlier step", () => {
    expect(resolveOnboardingStepAccess("website", session)).toEqual({ kind: "render" });
  });

  it("redirects a future step back to the furthest reached step", () => {
    expect(resolveOnboardingStepAccess("voice", session)).toEqual({
      kind: "redirect",
      to: "/onboarding/foundation",
    });
    expect(resolveOnboardingStepAccess("finish", session)).toEqual({
      kind: "redirect",
      to: "/onboarding/foundation",
    });
  });

  it("sends completed onboarding to the dashboard", () => {
    expect(
      resolveOnboardingStepAccess("review", { ...session, status: "completed", current_step: "finish" })
    ).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("treats a brand-new session as reaching only welcome", () => {
    const fresh = { status: "in_progress", current_step: "welcome", completed_steps: [] };
    expect(resolveOnboardingStepAccess("welcome", fresh)).toEqual({ kind: "render" });
    expect(resolveOnboardingStepAccess("source", fresh)).toEqual({
      kind: "redirect",
      to: "/onboarding/welcome",
    });
  });
});

describe("getFurthestStep", () => {
  it("never moves backwards", () => {
    expect(getFurthestStep("foundation", "snapshot")).toBe("foundation");
    expect(getFurthestStep("snapshot", "foundation")).toBe("foundation");
    expect(getFurthestStep(null, "source")).toBe("source");
    expect(getFurthestStep("not-a-step", "source")).toBe("source");
  });
});
