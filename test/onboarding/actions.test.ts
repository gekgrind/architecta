import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["referer", ""]])),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockGetOrCreate = vi.fn();
const mockUpdateStep = vi.fn();
const mockSaveProgress = vi.fn();
const mockLoadSession = vi.fn();
const mockCompleteWithData = vi.fn();

vi.mock("@/lib/onboarding/server", () => ({
  getOrCreateArchitectaOnboarding: () => mockGetOrCreate(),
  updateOnboardingStep: (...args: unknown[]) => mockUpdateStep(...args),
}));

vi.mock("@/lib/onboarding/persistence", () => ({
  saveOnboardingProgress: (...args: unknown[]) => mockSaveProgress(...args),
  loadOnboardingSession: () => mockLoadSession(),
  completeArchitectaOnboardingWithData: (...args: unknown[]) =>
    mockCompleteWithData(...args),
  loadSharedBusinessContext: vi.fn(async () => null),
  loadArchitectaBrandProfile: vi.fn(async () => null),
  buildPrefillFromSharedContext: vi.fn(() => ({})),
}));

vi.mock("@/lib/onboarding/website-analysis", () => ({
  analyzeWebsite: vi.fn(),
}));

vi.mock("@/lib/onboarding/website-step-flow", () => ({
  WEBSITE_ANALYSIS_FAILED_MESSAGE:
    "We couldn't analyze your website automatically.",
}));

describe("saveStepAnswers", () => {
  let saveStepAnswers: typeof import("@/lib/onboarding/actions").saveStepAnswers;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const mod = await import("@/lib/onboarding/actions");
    saveStepAnswers = mod.saveStepAnswers;
  });

  it("returns {ok: false} when getOrCreateArchitectaOnboarding throws", async () => {
    mockGetOrCreate.mockRejectedValueOnce(new Error("Not authenticated"));

    const result = await saveStepAnswers({ source_type: "new" }, "source");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Something went wrong");
    }
  });

  it("returns {ok: false} when saveOnboardingProgress returns an error", async () => {
    mockGetOrCreate.mockResolvedValueOnce({
      session: { id: "s1", current_step: "source" },
    });
    mockSaveProgress.mockResolvedValueOnce({
      ok: false,
      error: "Session not found",
    });

    const result = await saveStepAnswers({ source_type: "new" }, "source");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Session not found");
    }
  });

  it("returns {ok: false} when updateOnboardingStep throws", async () => {
    mockGetOrCreate.mockResolvedValueOnce({
      session: { id: "s1", current_step: "source" },
    });
    mockSaveProgress.mockResolvedValueOnce({ ok: true });
    mockUpdateStep.mockRejectedValueOnce(new Error("DB unavailable"));

    const result = await saveStepAnswers({ source_type: "new" }, "source");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Something went wrong");
    }
  });

  it("returns {ok: true, next} on success", async () => {
    mockGetOrCreate.mockResolvedValueOnce({
      session: { id: "s1", current_step: "source" },
    });
    mockSaveProgress.mockResolvedValueOnce({ ok: true });
    mockUpdateStep.mockResolvedValueOnce(undefined);

    const result = await saveStepAnswers({ source_type: "new" }, "source");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe("/onboarding/website");
    }
  });
});

describe("advanceArchitectaOnboardingStepClient", () => {
  let advanceArchitectaOnboardingStepClient: typeof import("@/lib/onboarding/actions").advanceArchitectaOnboardingStepClient;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { createSupabaseServerClient } = await import(
      "@/lib/supabase/server"
    );
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
      },
    });

    const mod = await import("@/lib/onboarding/actions");
    advanceArchitectaOnboardingStepClient =
      mod.advanceArchitectaOnboardingStepClient;
  });

  it("returns {ok: false} when updateOnboardingStep throws", async () => {
    mockUpdateStep.mockRejectedValueOnce(new Error("Network error"));

    const result = await advanceArchitectaOnboardingStepClient("welcome");

    expect(result.ok).toBe(false);
  });

  it("returns {ok: false} with session message when user is null", async () => {
    const { createSupabaseServerClient } = await import(
      "@/lib/supabase/server"
    );
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    vi.resetModules();
    const mod = await import("@/lib/onboarding/actions");

    const result = await mod.advanceArchitectaOnboardingStepClient("welcome");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("session");
    }
  });
});

describe("completeOnboarding", () => {
  let completeOnboarding: typeof import("@/lib/onboarding/actions").completeOnboarding;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const mod = await import("@/lib/onboarding/actions");
    completeOnboarding = mod.completeOnboarding;
  });

  it("returns {ok: false} when loadOnboardingSession returns null", async () => {
    mockLoadSession.mockResolvedValueOnce(null);

    const result = await completeOnboarding();

    expect(result.ok).toBe(false);
  });

  it("returns {ok: false} when completeArchitectaOnboardingWithData throws", async () => {
    mockLoadSession.mockResolvedValueOnce({ id: "s1", answers: {} });
    mockCompleteWithData.mockRejectedValueOnce(new Error("DB crash"));

    const result = await completeOnboarding();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Something went wrong");
    }
  });

  it("returns {ok: true} on success", async () => {
    mockLoadSession.mockResolvedValueOnce({ id: "s1", answers: {} });
    mockCompleteWithData.mockResolvedValueOnce({ ok: true });

    const result = await completeOnboarding();

    expect(result.ok).toBe(true);
  });
});
