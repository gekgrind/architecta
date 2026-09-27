import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { createSupabaseRecorder, type QueryResult } from "./supabase-recorder";

/**
 * Phase 1 regression coverage: Architecta onboarding is decoupled from the
 * shared Entrepreneuria onboarding flag, owns its completion state through
 * `onboarding_sessions` (app = 'architecta'), still reuses shared business
 * context, and supports backward navigation without losing progress.
 *
 * Only the Supabase client (and Next.js navigation/header primitives) are
 * doubled — the real onboarding helpers, routes and page run.
 */

const h = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["referer", ""]])),
}));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// The client component is irrelevant here; the page's props are what matter.
vi.mock("@/components/onboarding/BlueprintOnboarding", () => ({
  default: () => null,
}));

import HomePage from "@/app/page";
import OnboardingIndex from "@/app/onboarding/page";
import OnboardingStepPage from "@/app/onboarding/[step]/page";
import { GET as authCallback } from "@/app/auth/callback/route";
import { getArchitectaOnboardingStatus } from "@/lib/onboarding/server";
import { loadOnboardingContext, saveStepAnswers } from "@/lib/onboarding/actions";
import {
  completeArchitectaOnboardingWithData,
  type OnboardingAnswers,
} from "@/lib/onboarding/persistence";

// Vitest compiles the page's TSX with the classic runtime (React.createElement).
(globalThis as { React?: typeof React }).React = React;

const USER_ID = "user-1";

/** A founder who already finished Entrepreneuria onboarding. */
const ENTREPRENEURIA_PROFILE = {
  id: USER_ID,
  email: "founder@example.com",
  full_name: "Jordan Founder",
  name: "Jordan",
  industry: "Coaching",
  website: "https://jordan.example",
  website_url: "https://jordan.example",
  has_website: true,
  audience: "First-time founders",
  offer: "1:1 launch coaching",
  business_idea: null,
  onboarding_complete: true,
  onboarding_completed_at: "2026-01-01T00:00:00.000Z",
  onboarding_step: 7,
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    user_id: USER_ID,
    app: "architecta",
    current_step: "welcome",
    completed_steps: [],
    flags: {},
    answers: {},
    status: "in_progress",
    ...overrides,
  };
}

const ok = (data: unknown): QueryResult => ({ data, error: null });

function mockDb(tables: Parameters<typeof createSupabaseRecorder>[0]["tables"]) {
  const db = createSupabaseRecorder({ userId: USER_ID, tables });
  h.createSupabaseServerClient.mockResolvedValue(db.client);
  return db;
}

async function redirectOf(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

function onboardingFlagWrites(db: ReturnType<typeof createSupabaseRecorder>) {
  return db
    .writesTo("profiles")
    .filter((q) =>
      ["onboarding_complete", "onboarding_completed_at", "onboarding_step", "name"].some(
        (key) => q.payload && key in q.payload
      )
    );
}

beforeEach(() => {
  h.createSupabaseServerClient.mockReset();
});

/* =======================================================
   Shared onboarding separation / existing users
======================================================= */

describe("Entrepreneuria onboarding complete, no Architecta session", () => {
  function setup() {
    return mockDb({
      profiles: { select: ok(ENTREPRENEURIA_PROFILE) },
      onboarding_sessions: {
        select: ok(null),
        insert: ok(session()),
      },
      brand_profiles: { select: ok(null), insert: ok({ id: "bp-1", user_id: USER_ID }) },
    });
  }

  it("reports Architecta onboarding as incomplete", async () => {
    const db = setup();

    const status = await getArchitectaOnboardingStatus();

    expect(status.onboardingComplete).toBe(false);
    expect(status.currentStep).toBe("welcome");
    // Exactly one Architecta session is created; shared flags are untouched.
    expect(db.writesTo("onboarding_sessions")).toHaveLength(1);
    expect(db.writesTo("onboarding_sessions")[0].payload).toMatchObject({
      app: "architecta",
      status: "in_progress",
    });
    expect(db.writesTo("profiles")).toHaveLength(0);
  });

  it("root route sends the user into Architecta onboarding", async () => {
    setup();
    await expect(redirectOf(() => HomePage())).resolves.toBe("/onboarding");
  });

  it("auth callback sends the user into Architecta onboarding", async () => {
    setup();
    const res = await authCallback(
      new Request("https://architecta.test/auth/callback?next=/calendar")
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });
});

describe("completed Architecta session", () => {
  function setup() {
    return mockDb({
      profiles: { select: ok({ ...ENTREPRENEURIA_PROFILE, onboarding_complete: false }) },
      onboarding_sessions: {
        select: ok(session({ status: "completed", current_step: "finish" })),
      },
      brand_profiles: { select: ok({ id: "bp-1", user_id: USER_ID }) },
    });
  }

  it("is complete even when the shared profile flag is false", async () => {
    setup();
    const status = await getArchitectaOnboardingStatus();
    expect(status.onboardingComplete).toBe(true);
  });

  it("root route reaches the dashboard", async () => {
    setup();
    await expect(redirectOf(() => HomePage())).resolves.toBe("/dashboard");
  });

  it("auth callback honours the requested in-app destination", async () => {
    setup();
    const res = await authCallback(
      new Request("https://architecta.test/auth/callback?next=/calendar")
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/calendar");
  });

  it("step pages redirect to the dashboard", async () => {
    setup();
    await expect(
      redirectOf(() => OnboardingStepPage({ params: Promise.resolve({ step: "review" }) }))
    ).resolves.toBe("/dashboard");
  });
});

describe("in-progress Architecta session", () => {
  const savedAnswers = { brand_name: "Acme", industry: "SaaS", customer_role: "Agencies" };

  function setup() {
    return mockDb({
      profiles: { select: ok(ENTREPRENEURIA_PROFILE) },
      onboarding_sessions: {
        select: ok(
          session({
            current_step: "customers",
            completed_steps: ["source", "website", "snapshot", "market"],
            answers: savedAnswers,
          })
        ),
      },
      brand_profiles: { select: ok({ id: "bp-1", user_id: USER_ID }) },
    });
  }

  it("resumes from the persisted step without resetting answers or duplicating the session", async () => {
    const db = setup();

    const status = await getArchitectaOnboardingStatus();

    expect(status.onboardingComplete).toBe(false);
    expect(status.currentStep).toBe("customers");
    expect(status.answers).toEqual(savedAnswers);
    expect(db.writesTo("onboarding_sessions")).toHaveLength(0);
  });

  it("onboarding index resumes at the persisted step", async () => {
    setup();
    await expect(redirectOf(() => OnboardingIndex())).resolves.toBe("/onboarding/customers");
  });
});

/* =======================================================
   Shared state preservation on completion
======================================================= */

describe("completing Architecta onboarding", () => {
  const answers: OnboardingAnswers = {
    brand_name: "Acme Brand",
    industry: "SaaS",
    website_url: "https://acme.example",
    has_website: true,
    description: "Content systems for agencies",
    customer_role: "Agency owners",
    voice_tone: "direct",
  };

  function setup(profile: Record<string, unknown>, completedRows: unknown[] = [{ id: "sess-1" }]) {
    return mockDb({
      profiles: { select: ok(profile) },
      brand_profiles: { upsert: ok(null) },
      onboarding_sessions: { update: ok(completedRows) },
    });
  }

  it("marks only the Architecta session complete and never touches shared onboarding flags or name", async () => {
    const db = setup(ENTREPRENEURIA_PROFILE);

    const result = await completeArchitectaOnboardingWithData(answers);

    expect(result).toEqual({ ok: true });

    const sessionWrites = db.writesTo("onboarding_sessions");
    expect(sessionWrites).toHaveLength(1);
    expect(sessionWrites[0]).toMatchObject({
      op: "update",
      payload: { status: "completed", current_step: "finish" },
      filters: { user_id: USER_ID, app: "architecta" },
    });

    expect(onboardingFlagWrites(db)).toHaveLength(0);
    // Every shared business field was already set, so nothing is overwritten.
    expect(db.writesTo("profiles")).toHaveLength(0);

    // The brand name lives in Architecta's brand profile.
    expect(db.writesTo("brand_profiles")[0].payload).toMatchObject({
      brand_name: "Acme Brand",
      industry: "SaaS",
    });
  });

  it("backfills only empty shared business fields", async () => {
    const db = setup({
      industry: "Coaching",
      website: null,
      website_url: null,
      has_website: null,
      audience: "",
      offer: null,
      business_idea: null,
    });

    await expect(completeArchitectaOnboardingWithData(answers)).resolves.toEqual({ ok: true });

    const profileWrites = db.writesTo("profiles");
    expect(profileWrites).toHaveLength(1);
    expect(profileWrites[0].payload).toEqual({
      website_url: "https://acme.example",
      website: "https://acme.example",
      has_website: true,
      audience: "Agency owners",
      offer: "Content systems for agencies",
    });
    expect(onboardingFlagWrites(db)).toHaveLength(0);
  });

  it("fails rather than reporting success when no Architecta session was completed", async () => {
    setup(ENTREPRENEURIA_PROFILE, []);

    const result = await completeArchitectaOnboardingWithData(answers);

    expect(result.ok).toBe(false);
  });
});

/* =======================================================
   Existing shared context remains available
======================================================= */

describe("loadOnboardingContext with Entrepreneuria data", () => {
  it("prefills compatible shared business fields without treating the person's name as the brand", async () => {
    mockDb({
      profiles: { select: ok(ENTREPRENEURIA_PROFILE) },
      brand_profiles: { select: ok(null) },
      onboarding_sessions: { select: ok(session({ current_step: "snapshot" })) },
    });

    const ctx = await loadOnboardingContext();

    expect(ctx.answers).toMatchObject({
      industry: "Coaching",
      website_url: "https://jordan.example",
      has_website: true,
      customer_role: "First-time founders",
      description: "1:1 launch coaching",
    });
    expect(ctx.answers.brand_name).toBeUndefined();
    expect(ctx.hasExistingContext).toBe(true);
    expect(ctx.websiteUrl).toBe("https://jordan.example");
  });

  it("saved Architecta answers win over shared prefill", async () => {
    mockDb({
      profiles: { select: ok(ENTREPRENEURIA_PROFILE) },
      brand_profiles: { select: ok(null) },
      onboarding_sessions: {
        select: ok(session({ answers: { industry: "SaaS", customer_role: "Agencies" } })),
      },
    });

    const ctx = await loadOnboardingContext();

    expect(ctx.answers.industry).toBe("SaaS");
    expect(ctx.answers.customer_role).toBe("Agencies");
  });
});

/* =======================================================
   Back navigation
======================================================= */

describe("onboarding step routing (furthest reached = foundation)", () => {
  const savedAnswers = {
    website_url: "https://acme.example",
    brand_name: "Acme",
    customer_role: "Agencies",
    brand_values: ["Clarity"],
  };

  function setup() {
    return mockDb({
      profiles: { select: ok({ id: USER_ID }) },
      brand_profiles: { select: ok({ id: "bp-1", user_id: USER_ID }) },
      onboarding_sessions: {
        select: ok(
          session({
            current_step: "foundation",
            completed_steps: ["source", "website", "snapshot", "market", "customers"],
            answers: savedAnswers,
          })
        ),
        update: ok(null),
      },
    });
  }

  async function render(step: string) {
    const element = (await OnboardingStepPage({ params: Promise.resolve({ step }) })) as {
      props: { step: string; context: { answers: Record<string, unknown> } };
    };
    return element.props;
  }

  it("renders an earlier step with the saved answers", async () => {
    setup();
    const props = await render("website");
    expect(props.step).toBe("website");
    expect(props.context.answers).toMatchObject(savedAnswers);
  });

  it("renders the previous step", async () => {
    setup();
    await expect(render("customers")).resolves.toMatchObject({ step: "customers" });
  });

  it("renders the current step", async () => {
    setup();
    await expect(render("foundation")).resolves.toMatchObject({ step: "foundation" });
  });

  it("redirects a future step to the furthest reached step", async () => {
    setup();
    await expect(
      redirectOf(() => OnboardingStepPage({ params: Promise.resolve({ step: "voice" }) }))
    ).resolves.toBe("/onboarding/foundation");
  });

  it("re-saving an earlier step keeps answers and does not rewind progress", async () => {
    const db = setup();

    const result = await saveStepAnswers(
      { website_url: "https://acme-new.example", has_website: true },
      "website"
    );

    expect(result).toEqual({ ok: true, next: "/onboarding/snapshot" });

    const updates = db.writesTo("onboarding_sessions");
    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(update.payload?.current_step).toBe("foundation");
    }
    expect(updates[0].payload?.answers).toEqual({
      ...savedAnswers,
      website_url: "https://acme-new.example",
      has_website: true,
    });
  });
});
