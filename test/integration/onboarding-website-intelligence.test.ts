import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createSupabaseRecorder, type QueryResult, type RecordedQuery } from "../onboarding/supabase-recorder";
import { createFakeWebsiteAnalysisTable } from "../onboarding/fake-website-analysis-table";

/**
 * Cross-workstream coverage for the launch-critical integration:
 *
 *   #8  website intelligence (page discovery, structured data, autofill)
 *   #9  Architecta-owned onboarding persistence (session completion,
 *       fill-empty shared facts, non-regressing current_step)
 *   #10 AI guardrails (NVIDIA-only test mode, rate limit + daily budget)
 *   background website analysis (job table, after() fast path, read-time
 *       composition — the worker never writes onboarding answers)
 *
 * Only the network (fetch), the Supabase clients, usage logging and the
 * Next.js navigation/header primitives are doubled. The real onboarding
 * actions, persistence, website analysis, gateway, router, policy and
 * rate limiter run. No live provider is ever reached.
 */

const h = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  rateLimitRpc: vi.fn(),
  logLlmCall: vi.fn(),
  jobs: null as null | { from: (table: string) => unknown },
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(async () => ({
    rpc: h.rateLimitRpc,
    from: (table: string) => h.jobs!.from(table),
  })),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    h.afterCallbacks.push(cb);
  },
}));
vi.mock("@/lib/ai/llm/usage/logger", () => ({ logLlmCall: h.logLlmCall }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["referer", ""]])),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/onboarding/snapshot",
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import {
  completeOnboarding,
  loadOnboardingContext,
  runWebsiteAnalysis,
  saveStepAnswers,
} from "@/lib/onboarding/actions";
import { getArchitectaOnboardingStatus } from "@/lib/onboarding/server";
import CustomersStep from "@/components/onboarding/CustomersStep";
import FoundationStep from "@/components/onboarding/FoundationStep";
import MarketStep from "@/components/onboarding/MarketStep";
import SnapshotStep from "@/components/onboarding/SnapshotStep";
import VoiceStep from "@/components/onboarding/VoiceStep";
import type { OnboardingAnswers } from "@/lib/onboarding/persistence";

const USER_ID = "user-1";
const SITE_URL = "https://jordan.example";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/* =======================================================
   Fixtures
======================================================= */

/** A founder who already finished Entrepreneuria onboarding. */
function entrepreneuriaProfile() {
  return {
    id: USER_ID,
    email: "founder@example.com",
    full_name: "Jordan Founder",
    name: "Jordan",
    industry: "Coaching",
    website: SITE_URL,
    website_url: SITE_URL,
    has_website: true,
    audience: "First-time founders",
    offer: "1:1 launch coaching",
    business_idea: null,
    onboarding_complete: true,
    onboarding_completed_at: "2026-01-01T00:00:00.000Z",
    onboarding_step: 7,
  };
}

const HOMEPAGE_HTML = `<html><head><title>Jordan Launch Lab</title>
<meta property="og:site_name" content="Jordan Launch Lab">
</head><body>
<nav><a href="/about">About us</a><a href="https://elsewhere.example/about">Partner</a></nav>
<h1>Launch with a plan</h1>
<p>Jordan Launch Lab coaches solo SaaS founders from idea to first 100 customers with a repeatable launch system.</p>
</body></html>`;

const ABOUT_HTML = `<html><body><h1>About</h1>
<p>ABOUT-PAGE-EVIDENCE: we believe in clarity and integrity for every founder we coach.</p>
</body></html>`;

/** What the (mocked) NVIDIA model extracts from the site. */
const MODEL_ANALYSIS = {
  brand_name: "Jordan Launch Lab",
  industry: "Business coaching",
  description: "Launch coaching for solo SaaS founders",
  audience: "Solo SaaS founders",
  typical_customers: "Solo SaaS founders preparing a launch",
  offers: "Launch sprints",
  tone: "Direct and practical",
  voice_characteristics: "No-fluff",
  topics: ["launch strategy"],
  mission: "Help every founder launch with a plan.",
  values: "Clarity, Integrity",
  differentiators: ["Founder-led"],
  cta_patterns: ["Book a call"],
  confidence: "high",
};

/* =======================================================
   Stateful Supabase double (enough to reload between steps)
======================================================= */

type DbState = {
  profile: Record<string, unknown>;
  session: Record<string, unknown>;
  brand: Record<string, unknown>;
};

const ok = (data: unknown): QueryResult => ({ data, error: null });

/** Runs whatever after() scheduled — the background fast path. */
async function runBackground() {
  for (const cb of h.afterCallbacks.splice(0)) await cb();
}

function setupDb(sessionOverrides: Record<string, unknown> = {}) {
  const jobs = createFakeWebsiteAnalysisTable();
  h.jobs = jobs;
  h.afterCallbacks.length = 0;

  const state: DbState = {
    profile: entrepreneuriaProfile(),
    session: {
      id: "sess-1",
      user_id: USER_ID,
      app: "architecta",
      current_step: "snapshot",
      completed_steps: ["welcome", "source", "website"],
      flags: {},
      answers: {},
      status: "in_progress",
      ...sessionOverrides,
    },
    brand: { id: "bp-1", user_id: USER_ID },
  };

  const apply = (row: Record<string, unknown>) => (q: RecordedQuery) => {
    Object.assign(row, q.payload);
    return ok([{ id: row.id }]);
  };

  const db = createSupabaseRecorder({
    userId: USER_ID,
    tables: {
      profiles: { select: () => ok({ ...state.profile }), update: apply(state.profile) },
      onboarding_sessions: {
        select: () => ok(structuredClone(state.session)),
        update: apply(state.session),
      },
      brand_profiles: { select: () => ok({ ...state.brand }), upsert: apply(state.brand) },
      // The user's own job, as RLS + column grants expose it (status/result only).
      architecta_website_analyses: {
        select: (q) => {
          const row = [...jobs.rows.values()].find((r) => r.session_id === q.filters.session_id);
          return ok(row ? { status: row.status, result: row.result } : null);
        },
      },
      // A historical settings row pinned to a paid provider must not
      // override NVIDIA-only mode.
      architecta_user_settings: {
        select: ok({
          text_provider: "anthropic",
          anthropic_model: "claude-sonnet-4-6",
          openai_text_model: "gpt-4o",
          openai_image_model: "gpt-image-1",
          openai_video_model: null,
        }),
      },
    },
  });

  h.createSupabaseServerClient.mockResolvedValue(db.client);
  return { db, state, jobs };
}

/* =======================================================
   Network double
======================================================= */

const fetchMock = vi.fn();

function htmlResponse(html: string, url: string) {
  const res = new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

function nvidiaCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url) === NVIDIA_URL);
}

function paidProviderCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    /api\.openai\.com|api\.anthropic\.com/.test(String(url))
  );
}

beforeEach(() => {
  h.createSupabaseServerClient.mockReset();
  vi.stubEnv("AI_TEST_PROVIDER", "nvidia");
  vi.stubEnv("NVIDIA_API_KEY", "nvapi-FAKE-TEST-KEY");
  // Paid keys are present on purpose: NVIDIA-only mode must still not use them.
  vi.stubEnv("OPENAI_API_KEY", "sk-FAKE-TEST-KEY");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-FAKE-TEST-KEY");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input: string | URL) => {
    const url = String(input);
    if (url === `${SITE_URL}/about`) return htmlResponse(ABOUT_HTML, url);
    if (url.startsWith(SITE_URL)) return htmlResponse(HOMEPAGE_HTML, url);
    if (url === NVIDIA_URL) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(MODEL_ANALYSIS) } }],
          usage: { prompt_tokens: 900, completion_tokens: 200, total_tokens: 1100 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response("unexpected outbound call", { status: 500 });
  });
  h.rateLimitRpc.mockResolvedValue({
    data: [{ allowed: true, remaining: 4, reset_at: null }],
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* =======================================================
   Rendering helpers — the steps' real initial field values
======================================================= */

function renderStep(
  Component: (props: { answers: OnboardingAnswers; sessionId: string; hasExistingContext: boolean }) => unknown,
  answers: OnboardingAnswers
) {
  return renderToStaticMarkup(
    createElement(Component as never, { answers, sessionId: "sess-1", hasExistingContext: true })
  );
}

/* =======================================================
   Scenario A + B: existing Entrepreneuria user, NVIDIA-only analysis
======================================================= */

describe("Existing Entrepreneuria user enters Architecta (Scenario A)", () => {
  it("is not skipped past Architecta onboarding by the shared completion flag", async () => {
    setupDb();

    const status = await getArchitectaOnboardingStatus();

    expect(status.onboardingComplete).toBe(false);
    expect(status.currentStep).toBe("snapshot");
  });
});

describe("Website analysis under AI_TEST_PROVIDER=nvidia (Scenario B)", () => {
  it("analyzes via NVIDIA only, including a discovered same-origin page, under the AI limits", async () => {
    const { state, jobs } = setupDb();

    const result = await runWebsiteAnalysis(SITE_URL);

    // The request returns once the site is read and queued — before any model call.
    expect(result).toEqual({ ok: true, status: "queued" });
    expect(nvidiaCalls()).toHaveLength(0);

    await runBackground();

    // One model call, on NVIDIA, carrying the #8 secondary-page evidence.
    expect(nvidiaCalls()).toHaveLength(1);
    const body = JSON.parse(String((nvidiaCalls()[0][1] as RequestInit).body));
    expect(JSON.stringify(body.messages)).toContain("ABOUT-PAGE-EVIDENCE");
    expect(body.max_tokens).toBeLessThanOrEqual(4096);

    // No paid provider was contacted despite the anthropic pin and paid keys.
    expect(paidProviderCalls()).toHaveLength(0);
    // Off-origin links are never fetched.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("elsewhere.example"))).toBe(false);

    // #10 per-action limit + daily budget were both checked.
    const keys = h.rateLimitRpc.mock.calls.map(([, args]) => args.p_key);
    expect(keys).toContain(`onboarding.website_analysis:${USER_ID}`);
    expect(keys.some((k: string) => k.startsWith("ai.daily."))).toBe(true);

    // Stored on the job only — never written into the session's answers —
    // and progress is not rewound.
    expect(jobs.only()).toMatchObject({ status: "completed", attempts: 1 });
    expect((jobs.only().result as OnboardingAnswers["website_analysis"])?.brand_name).toBe("Jordan Launch Lab");
    expect((state.session.answers as OnboardingAnswers).website_analysis).toBeUndefined();
    expect(state.session.current_step).toBe("snapshot");
  });

  it("stops before the model when the AI limit is exhausted and leaves the session untouched", async () => {
    const { db, jobs } = setupDb();
    h.rateLimitRpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: null }],
      error: null,
    });

    const result = await runWebsiteAnalysis(SITE_URL);
    await runBackground();

    expect(result.ok).toBe(false);
    expect(jobs.rows.size).toBe(0);
    expect(nvidiaCalls()).toHaveLength(0);
    expect(paidProviderCalls()).toHaveLength(0);
    expect(db.writesTo("onboarding_sessions")).toHaveLength(0);
  });

  it("fails closed with no model call when the limiter itself errors", async () => {
    setupDb();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    h.rateLimitRpc.mockResolvedValue({ data: null, error: { message: "db down" } });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    expect(nvidiaCalls()).toHaveLength(0);
  });

  it("keeps a failed NVIDIA attempt in the background: retry queued, no paid fallback, session untouched", async () => {
    const { db, jobs } = setupDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith(SITE_URL)) return htmlResponse(HOMEPAGE_HTML, url);
      if (url === NVIDIA_URL) return new Response("upstream down", { status: 503 });
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await runWebsiteAnalysis(SITE_URL);
    await runBackground();

    // The user already moved on; the failure only schedules a cron retry.
    expect(result).toEqual({ ok: true, status: "queued" });
    expect(jobs.only()).toMatchObject({ status: "queued", attempts: 1, error_code: "provider" });
    expect(paidProviderCalls()).toHaveLength(0);
    expect(db.writesTo("onboarding_sessions")).toHaveLength(0);
  });
});

/* =======================================================
   Prefill priority after analysis + reload
   saved Architecta answer → explicit shared data → website → blank
======================================================= */

describe("Onboarding prefill priority across shared data and website intelligence", () => {
  async function analyzedContext() {
    const env = setupDb();
    const result = await runWebsiteAnalysis(SITE_URL);
    expect(result.ok).toBe(true);
    await runBackground();
    // Reload: everything below comes from persisted state only.
    const ctx = await loadOnboardingContext();
    return { ...env, ctx };
  }

  it("keeps explicit shared Entrepreneuria facts over website inference, and fills gaps from the website", async () => {
    const { ctx } = await analyzedContext();

    const snapshot = renderStep(SnapshotStep, ctx.answers);
    // Shared explicit industry/offer win over the website's reading.
    expect(snapshot).toContain('value="Coaching"');
    expect(snapshot).not.toContain('value="Business coaching"');
    expect(snapshot).toContain("1:1 launch coaching");
    expect(snapshot).not.toContain("Launch coaching for solo SaaS founders");
    // Brand name is a gap (the person's shared name is never a brand) → website fills it.
    expect(snapshot).toContain('value="Jordan Launch Lab"');
    expect(snapshot).not.toContain('value="Jordan"');

    // Shared audience wins over the website's typical customer.
    const customers = renderStep(CustomersStep, ctx.answers);
    expect(customers).toContain('value="First-time founders"');
    expect(customers).not.toContain("Solo SaaS founders preparing a launch");

    // No shared equivalent → confident website values fill the gaps.
    const market = renderStep(MarketStep, ctx.answers);
    expect(market).toContain('value="Business coaching"');
    const voice = renderStep(VoiceStep, ctx.answers);
    expect(ctx.answers.voice_tone).toBeUndefined();
    expect(voice).toMatch(/Direct/);
  });

  it("saved Architecta answers win over both shared data and the website (Scenario C)", async () => {
    await analyzedContext();

    const saved = await saveStepAnswers(
      { brand_name: "Jordan & Co", industry: "Founder coaching", description: "Launch intensives" },
      "snapshot"
    );
    expect(saved).toEqual({ ok: true, next: "/onboarding/market" });

    const ctx = await loadOnboardingContext();
    const snapshot = renderStep(SnapshotStep, ctx.answers);

    expect(snapshot).toContain('value="Jordan &amp; Co"');
    expect(snapshot).toContain('value="Founder coaching"');
    expect(snapshot).toContain("Launch intensives");
    expect(snapshot).not.toContain('value="Coaching"');
    expect(snapshot).not.toContain('value="Jordan Launch Lab"');
    // The analysis survives the reload alongside the saved answers.
    expect(ctx.answers.website_analysis?.brand_name).toBe("Jordan Launch Lab");
  });

  it("Back navigation: re-saving an earlier step keeps later progress and the analysis", async () => {
    const { state } = await analyzedContext();
    await saveStepAnswers({ brand_name: "Jordan & Co", industry: "Founder coaching" }, "snapshot");
    await saveStepAnswers({ primary_market: "Coaching" }, "market");
    const furthest = state.session.current_step;

    // Back to the website step and re-save it.
    await saveStepAnswers({ website_url: SITE_URL, has_website: true }, "website");

    expect(state.session.current_step).toBe(furthest);
    const answers = state.session.answers as OnboardingAnswers;
    expect(answers.brand_name).toBe("Jordan & Co");
    expect(answers.primary_market).toBe("Coaching");
    // The analysis lives in the job table and is composed in on reload.
    expect(answers.website_analysis).toBeUndefined();
    expect((await loadOnboardingContext()).answers.website_analysis?.brand_name).toBe("Jordan Launch Lab");
  });
});

/* =======================================================
   Background analysis finishing after the user has answered
======================================================= */

describe("A late background result never overwrites user answers", () => {
  it("answers saved while the analysis was still running win after it completes", async () => {
    const { state } = setupDb();
    await runWebsiteAnalysis(SITE_URL);

    // The user answers Snapshot and Market before GLM finishes.
    await saveStepAnswers(
      { brand_name: "Jordan & Co", industry: "Founder coaching", description: "Launch intensives" },
      "snapshot"
    );
    await saveStepAnswers({ primary_market: "Coaching" }, "market");
    const answersBefore = structuredClone(state.session.answers);

    await runBackground(); // analysis completes now

    expect(state.session.answers).toEqual(answersBefore);
    const ctx = await loadOnboardingContext();
    expect(ctx.answers.website_analysis?.brand_name).toBe("Jordan Launch Lab");
    expect(ctx.websiteAnalysisStatus).toBe("completed");

    const snapshot = renderStep(SnapshotStep, ctx.answers);
    expect(snapshot).toContain('value="Jordan &amp; Co"');
    expect(snapshot).not.toContain('value="Jordan Launch Lab"');
    const market = renderStep(MarketStep, ctx.answers);
    expect(market).toContain('value="Coaching"');
    expect(market).not.toContain('value="Business coaching"');
  });

  it("reports the pending status to the steps while the analysis runs", async () => {
    setupDb();
    await runWebsiteAnalysis(SITE_URL);

    const ctx = await loadOnboardingContext();

    expect(ctx.websiteAnalysisStatus).toBe("queued");
    expect(ctx.answers.website_analysis).toBeUndefined();
  });
});

describe("Low-confidence website analysis", () => {
  it("does not pre-select Foundation values or a Voice tone", async () => {
    const { jobs } = setupDb();
    await runWebsiteAnalysis(SITE_URL);
    await runBackground();
    jobs.only().result = { ...(jobs.only().result as object), confidence: "low" };

    const ctx = await loadOnboardingContext();
    expect(ctx.answers.website_analysis?.confidence).toBe("low");

    const foundation = renderStep(FoundationStep, ctx.answers);
    expect(foundation).not.toContain("Pre-selected based on your website");
    const voice = renderStep(VoiceStep, ctx.answers);
    expect(voice).not.toContain("based on your website");
    expect(voice).not.toContain("Direct and practical");
  });

  it("a confident analysis does pre-select them", async () => {
    setupDb();
    await runWebsiteAnalysis(SITE_URL);
    await runBackground();

    const ctx = await loadOnboardingContext();
    expect(renderStep(FoundationStep, ctx.answers)).toContain("Pre-selected based on your website");
    expect(renderStep(VoiceStep, ctx.answers)).toContain("We pre-selected a tone below based on your website");
  });
});

describe("No-website path", () => {
  it("continues without fetching, queueing or calling a model", async () => {
    const { jobs } = setupDb({ current_step: "website" });

    const result = await saveStepAnswers({ has_website: false }, "website");

    expect(result).toEqual({ ok: true, next: "/onboarding/snapshot" });
    expect(jobs.rows.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.afterCallbacks).toHaveLength(0);
  });
});

/* =======================================================
   Completion
======================================================= */

describe("Completing Architecta onboarding after website analysis", () => {
  it("marks only the Architecta session complete and leaves shared completion/name state untouched", async () => {
    const { db, state } = setupDb();
    await runWebsiteAnalysis(SITE_URL);
    await runBackground();
    await saveStepAnswers(
      { brand_name: "Jordan & Co", industry: "Founder coaching", description: "Launch intensives" },
      "snapshot"
    );
    const profileBefore = { ...state.profile };

    const result = await completeOnboarding();

    expect(result).toEqual({ ok: true, next: "/dashboard" });
    expect(state.session.status).toBe("completed");

    // Shared profile: every business field was already set, so nothing is
    // overwritten; completion flags and the personal name are never written.
    expect(db.writesTo("profiles")).toHaveLength(0);
    expect(state.profile).toEqual(profileBefore);

    // Brand data lands in Architecta's brand profile, with website insights
    // only filling what the user never answered.
    const brand = db.writesTo("brand_profiles")[0].payload as Record<string, unknown>;
    expect(brand).toMatchObject({ brand_name: "Jordan & Co", industry: "Founder coaching" });
    expect(brand.mission).toBe("Help every founder launch with a plan.");

    // Status now reads complete from the Architecta session alone.
    const status = await getArchitectaOnboardingStatus();
    expect(status.onboardingComplete).toBe(true);
  });
});
