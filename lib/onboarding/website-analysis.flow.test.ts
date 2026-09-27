import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeWebsiteAnalysisTable } from "@/test/onboarding/fake-website-analysis-table";

/**
 * Website-analysis path with only the network and database mocked:
 *
 *   runWebsiteAnalysis → enqueueWebsiteAnalysis → prepareWebsiteAnalysis
 *   (fetch/extract, synchronous)  ··· after() ···  processWebsiteAnalysisJob →
 *   executeWebsiteAnalysis → runGateway → router → NVIDIA client
 *
 * No live API calls are made.
 */

const h = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  logLlmCall: vi.fn(),
  getOrCreateArchitectaOnboarding: vi.fn(),
  updateOnboardingStep: vi.fn(),
  saveOnboardingProgress: vi.fn(),
  rateLimitRpc: vi.fn(),
  jobs: null as null | { from: (table: string) => unknown },
  afterCallbacks: [] as Array<() => Promise<unknown> | unknown>,
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
vi.mock("@/lib/ai/llm/usage/logger", () => ({ logLlmCall: h.logLlmCall }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    h.afterCallbacks.push(cb);
  },
}));
vi.mock("./server", () => ({
  getOrCreateArchitectaOnboarding: h.getOrCreateArchitectaOnboarding,
  updateOnboardingStep: h.updateOnboardingStep,
}));
vi.mock("./persistence", () => ({
  saveOnboardingProgress: h.saveOnboardingProgress,
  loadSharedBusinessContext: vi.fn(),
  loadArchitectaBrandProfile: vi.fn(),
  loadOnboardingSession: vi.fn(),
  buildPrefillFromSharedContext: vi.fn(),
  completeArchitectaOnboardingWithData: vi.fn(),
}));

import { runWebsiteAnalysis } from "./actions";
import { executeWebsiteAnalysis, prepareWebsiteAnalysis, redactSecrets } from "./website-analysis";

const USER_ID = "user-test-123";
const SITE_URL = "https://acme.example.com";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const FAKE_NVIDIA_KEY = "nvapi-FAKEKEYFORTESTS-1234567890";
const LEAKED_OPENAI_KEY = "sk-proj-abcDEF1234567890xyz";

const SITE_HTML = `<html><head><title>Acme Growth Studio</title>
<meta name="description" content="Acme helps B2B founders build repeatable content systems."></head>
<body><h1>Build a growth engine</h1><p>Acme Growth Studio designs content systems for bootstrapped SaaS founders who want predictable pipeline.</p>
<p>Book a strategy call today.</p></body></html>`;

function htmlResponse(html: string, url: string) {
  const res = new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

function nvidiaResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function nvidiaContent(content: string) {
  return nvidiaResponse({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 900, completion_tokens: 200, total_tokens: 1100 },
  });
}

const fetchMock = vi.fn();
let nvidiaReply: () => Response | Promise<Response>;
let jobs: ReturnType<typeof createFakeWebsiteAnalysisTable>;

function mockSupabase({ user = { id: USER_ID } as { id: string } | null } = {}) {
  const builder = {
    from: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    // A user who pinned OpenAI in settings must still be routed to NVIDIA.
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: {
          text_provider: "openai",
          anthropic_model: "claude-sonnet-4-6",
          openai_text_model: "gpt-4o",
          openai_image_model: "gpt-image-1",
          openai_video_model: null,
        },
        error: null,
      })
    ),
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })) },
  };
  h.createSupabaseServerClient.mockResolvedValue(builder);
}

function calledUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

function nvidiaCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url) === NVIDIA_URL);
}

/** Preparation + one execution, as the background job runs them. */
async function analyze(url = SITE_URL) {
  const prepared = await prepareWebsiteAnalysis(url);
  if (!prepared.ok) return prepared;
  return executeWebsiteAnalysis(USER_ID, prepared.evidence, { background: true });
}

async function runAfterCallbacks() {
  const pending = h.afterCallbacks.splice(0);
  for (const cb of pending) await cb();
}

beforeEach(() => {
  vi.stubEnv("NVIDIA_API_KEY", FAKE_NVIDIA_KEY);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input: string | URL) => {
    const url = String(input);
    if (url.startsWith(SITE_URL)) return htmlResponse(SITE_HTML, url);
    if (url === NVIDIA_URL) return nvidiaReply();
    return new Response("unexpected outbound call", { status: 500 });
  });
  mockSupabase();
  jobs = createFakeWebsiteAnalysisTable();
  h.jobs = jobs;
  h.afterCallbacks.length = 0;
  h.getOrCreateArchitectaOnboarding.mockResolvedValue({ session: { id: "sess-1" } });
  h.saveOnboardingProgress.mockResolvedValue({ ok: true });
  h.rateLimitRpc.mockResolvedValue({
    data: [{ allowed: true, remaining: 4, reset_at: null }],
    error: null,
  });
  nvidiaReply = () => nvidiaContent('{"brand_name": "Acme", "confidence": "high"}');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* =======================================================
   Background execution: NVIDIA success
======================================================= */

describe("executeWebsiteAnalysis — NVIDIA success", () => {
  const MODEL_OUTPUT = `<think>The site is about content systems.</think>
Here is the analysis:
\`\`\`json
{
  "brand_name": "Acme Growth Studio",
  "industry": "B2B marketing services",
  "description": "Acme designs content systems for SaaS founders.",
  "audience": "Bootstrapped SaaS founders",
  "offers": "Content system design",
  "tone": "confident",
  "topics": ["content systems", "pipeline", 42],
  "differentiators": ["Founder-centric"],
  "cta_patterns": ["Book a strategy call"],
  "mission": null,
  "confidence": "high",
}
\`\`\``;

  beforeEach(() => {
    nvidiaReply = () => nvidiaContent(MODEL_OUTPUT);
  });

  it("analyzes the site via NVIDIA z-ai/glm-5.3 and returns the validated result", async () => {
    const result = await analyze();

    expect(result.ok).toBe(true);
    if (!result.ok || !("analysis" in result)) return;

    expect(result.model).toBe("z-ai/glm-5.3");
    expect(result.analysis).toMatchObject({
      brand_name: "Acme Growth Studio",
      industry: "B2B marketing services",
      audience: "Bootstrapped SaaS founders",
      offers: "Content system design",
      tone: "confident",
      topics: ["content systems", "pipeline"],
      differentiators: ["Founder-centric"],
      cta_patterns: ["Book a strategy call"],
      confidence: "high",
    });
    expect(result.analysis.mission).toBeUndefined();
    expect(typeof result.analysis.analyzed_at).toBe("string");
  });

  it("sends the existing analysis prompt to NVIDIA with the right model and key", async () => {
    await analyze();

    const calls = nvidiaCalls();
    expect(calls).toHaveLength(1);
    const init = calls[0][1];
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_NVIDIA_KEY}`);

    const body = JSON.parse(init.body);
    expect(body.model).toBe("z-ai/glm-5.3");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(4096);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("marketing analyst");
    expect(body.messages[1].content).toContain("---WEBSITE CONTENT START---");
    expect(body.messages[1].content).toContain("Acme Growth Studio");
  });

  // Regression: with default reasoning GLM-5.3 took ~100s on real sites and
  // hit the 90s provider timeout, surfacing the generic failure in onboarding.
  it("requests low reasoning effort so the call finishes within the provider timeout", async () => {
    await analyze();

    const body = JSON.parse(nvidiaCalls()[0][1].body);
    expect(body.reasoning_effort).toBe("low");
  });

  it("makes no OpenAI (or other provider) calls and needs no OPENAI_API_KEY, even when the user pinned OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await analyze();

    expect(result.ok).toBe(true);
    const urls = calledUrls();
    expect(urls.some((u) => u.includes("api.openai.com"))).toBe(false);
    expect(urls.some((u) => u.includes("api.anthropic.com"))).toBe(false);
    expect(urls).toEqual([SITE_URL, NVIDIA_URL]);
  });

  it("records usage against the nvidia provider as a background call for the job's user", async () => {
    await analyze();

    expect(h.logLlmCall).toHaveBeenCalledTimes(1);
    const logged = h.logLlmCall.mock.calls[0][0];
    expect(logged.result).toMatchObject({ provider: "nvidia", model: "z-ai/glm-5.3", usedFallback: false });
    expect(logged.input).toMatchObject({ userId: USER_ID, background: true });
  });
});

/* =======================================================
   Preparation: bounded secondary page discovery
======================================================= */

describe("prepareWebsiteAnalysis — secondary page discovery", () => {
  const ABOUT_URL = `${SITE_URL}/about`;
  const PRICING_URL = `${SITE_URL}/pricing`;

  const HOMEPAGE_WITH_LINKS = `<html><head><title>Acme Growth Studio</title>
<meta name="description" content="Acme helps B2B founders build repeatable content systems."></head>
<body><h1>Build a growth engine</h1><p>Acme Growth Studio designs content systems for bootstrapped SaaS founders.</p>
<nav><a href="/about">About us</a><a href="/pricing">Pricing</a><a href="/terms">Terms of Service</a></nav>
<p>Book a strategy call today.</p></body></html>`;

  const ABOUT_HTML = `<html><body><h1>Our story</h1><p>Founded in 2021 to help SaaS founders skip the growth-marketing guesswork.</p>
<a href="/careers">Careers</a></body></html>`;

  it("fetches same-origin About/Pricing pages (never legal pages) and makes one model call for all of them", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return htmlResponse("<html><body><p>Starter plan: $29/mo.</p></body></html>", url);
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await analyze();

    expect(result.ok).toBe(true);
    expect(calledUrls().sort()).toEqual([ABOUT_URL, NVIDIA_URL, PRICING_URL, SITE_URL].sort());

    const body = JSON.parse(nvidiaCalls()[0][1].body);
    const prompt: string = body.messages[1].content;
    expect(prompt).toContain("ABOUT PAGE");
    expect(prompt).toContain("Founded in 2021");
    expect(prompt).toContain("PRICING PAGE");
    expect(prompt).toContain("Starter plan");
    expect(nvidiaCalls()).toHaveLength(1);
  });

  it("falls back to homepage-only evidence when a secondary page fails", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return new Response("not found", { status: 404 });
      return new Response("unexpected outbound call", { status: 500 });
    });

    const prepared = await prepareWebsiteAnalysis(SITE_URL);

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.evidence.content).toContain("ABOUT PAGE");
    expect(prepared.evidence.content).not.toContain("PRICING PAGE");
  });

  it("still succeeds homepage-only when every secondary page fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL || url === PRICING_URL) throw new TypeError("fetch failed");
      return new Response("unexpected outbound call", { status: 500 });
    });

    const prepared = await prepareWebsiteAnalysis(SITE_URL);

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.evidence.content).toContain("Build a growth engine");
  });

  it("does not recurse into links found on a secondary page", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      // ABOUT_HTML itself links to /careers — that must never be fetched.
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return htmlResponse("<html><body>Pricing</body></html>", url);
      return new Response("unexpected outbound call", { status: 500 });
    });

    await prepareWebsiteAnalysis(SITE_URL);

    expect(calledUrls()).not.toContain(`${SITE_URL}/careers`);
  });

  it("does not follow a secondary page redirect to an unsafe host", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL) {
        // Simulate a same-origin link that redirects off-site to a private IP.
        return htmlResponse(ABOUT_HTML, "http://169.254.169.254/about");
      }
      if (url === PRICING_URL) return htmlResponse("<html><body>Pricing info</body></html>", url);
      return new Response("unexpected outbound call", { status: 500 });
    });

    const prepared = await prepareWebsiteAnalysis(SITE_URL);

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.evidence.content).not.toContain("Founded in 2021");
  });

  it("rejects private/metadata URLs before any fetch", async () => {
    for (const url of ["http://169.254.169.254/latest/meta-data", "http://localhost:3000", "http://10.0.0.5"]) {
      const prepared = await prepareWebsiteAnalysis(url);
      expect(prepared.ok).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses JSON-LD/OpenGraph facts as a fallback when the model's own extraction misses them", async () => {
    const HOMEPAGE_WITH_JSONLD = `<html><head><title>Acme</title>
<script type="application/ld+json">{"@type":"Organization","name":"Acme Growth Studio","description":"Content systems for SaaS founders."}</script>
</head><body><p>Some homepage copy that never restates the brand name.</p></body></html>`;

    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_JSONLD, url);
      if (url === NVIDIA_URL) return nvidiaContent('{"confidence": "medium"}');
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await analyze();

    expect(result.ok).toBe(true);
    if (!result.ok || !("analysis" in result)) return;
    expect(result.analysis.brand_name).toBe("Acme Growth Studio");
    expect(result.analysis.description).toBe("Content systems for SaaS founders.");
  });

  it("never lets a website-provided JSON-LD field override the model's own answer", async () => {
    const HOMEPAGE_WITH_JSONLD = `<html><head><title>Acme</title>
<script type="application/ld+json">{"@type":"Organization","name":"Wrong Name From JSON-LD"}</script>
</head><body><p>Acme designs content systems for bootstrapped SaaS founders who want predictable pipeline and growth.</p></body></html>`;

    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_JSONLD, url);
      if (url === NVIDIA_URL) return nvidiaContent('{"brand_name": "Model-Extracted Name", "confidence": "high"}');
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await analyze();

    expect(result.ok).toBe(true);
    if (!result.ok || !("analysis" in result)) return;
    expect(result.analysis.brand_name).toBe("Model-Extracted Name");
  });
});

/* =======================================================
   Structured output resilience
======================================================= */

describe("executeWebsiteAnalysis — output parsing", () => {
  it("accepts bare JSON with missing optional fields without inventing data", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme"}');

    const result = await analyze();

    expect(result.ok).toBe(true);
    if (!result.ok || !("analysis" in result)) return;
    expect(result.analysis.brand_name).toBe("Acme");
    expect(result.analysis.industry).toBeUndefined();
    expect(result.analysis.topics).toBeUndefined();
    expect(result.analysis.confidence).toBe("low");
  });

  it("keeps list answers for prose fields instead of dropping them", async () => {
    nvidiaReply = () =>
      nvidiaContent('{"brand_name": "Acme", "offers": ["Content system design", "Strategy calls", 7]}');

    const result = await analyze();

    expect(result.ok).toBe(true);
    if (!result.ok || !("analysis" in result)) return;
    expect(result.analysis.offers).toBe("Content system design; Strategy calls");
  });

  it.each([
    ["the reply is truncated mid-JSON", () =>
      nvidiaResponse({
        choices: [{ message: { content: '```json\n{"brand_name": "Acme", "descr' }, finish_reason: "length" }],
      })],
    ["the JSON is malformed", () => nvidiaContent('{"brand_name": "Acme", "industry": ')],
    ["the model returns no JSON object", () => nvidiaContent("<think>thinking…</think>")],
    ["the model returns a JSON array", () => nvidiaContent('["Acme"]')],
  ])("reports a retryable parse failure when %s", async (_label, reply) => {
    nvidiaReply = reply;
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await analyze()).toEqual({ ok: false, category: "parse" });
  });
});

/* =======================================================
   Provider failure classification + sanitization
======================================================= */

describe("executeWebsiteAnalysis — NVIDIA failure", () => {
  it("classifies auth failures as permanent and never leaks keys or provider text", async () => {
    nvidiaReply = () =>
      nvidiaResponse(
        {
          error: {
            message: `Incorrect API key provided: ${LEAKED_OPENAI_KEY}. Authorization: Bearer ${FAKE_NVIDIA_KEY}`,
          },
        },
        401
      );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await analyze();

    expect(result).toEqual({ ok: false, category: "authentication" });

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("401");
    expect(logged).not.toContain(LEAKED_OPENAI_KEY);
    expect(logged).not.toContain(FAKE_NVIDIA_KEY);

    // Auth failures are not retried and do not fall back to another provider.
    expect(nvidiaCalls()).toHaveLength(1);
    expect(calledUrls().some((u) => u.includes("api.openai.com"))).toBe(false);
  });

  it("classifies a missing NVIDIA_API_KEY as a configuration failure", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await analyze()).toEqual({ ok: false, category: "configuration" });
    expect(calledUrls().some((u) => u.includes("api.openai.com"))).toBe(false);
  });

  it("classifies a provider timeout as a (retryable) timeout", async () => {
    nvidiaReply = () => nvidiaResponse({ error: "timed out" }, 408);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await analyze()).toEqual({ ok: false, category: "timeout" });
  });

  it("classifies an NVIDIA 429 as rate_limit", async () => {
    nvidiaReply = () => nvidiaResponse({ error: "Too Many Requests" }, 429);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await analyze()).toEqual({ ok: false, category: "rate_limit" });
  });

  it("reports unreachable sites during preparation, without calling the model", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await prepareWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("We couldn't read your website");
    expect(result.error).toContain("continue manually");
    expect(nvidiaCalls()).toHaveLength(0);
  });
});

/* =======================================================
   Onboarding action: enqueue, don't wait for the model
======================================================= */

describe("runWebsiteAnalysis — background enqueue", () => {
  it("returns as soon as the site is read and queued, without waiting for GLM", async () => {
    // The model never answers: the action must still resolve.
    nvidiaReply = () => new Promise<Response>(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: true, status: "queued" });
    expect(nvidiaCalls()).toHaveLength(0);
    expect(jobs.only()).toMatchObject({ session_id: "sess-1", user_id: USER_ID, status: "queued" });
    // Only the fast-path trigger is scheduled; nothing ran inside the request.
    expect(h.afterCallbacks).toHaveLength(1);
  });

  it("runs exactly one model attempt in the after() fast path and stores the result in the job only", async () => {
    await runWebsiteAnalysis(SITE_URL);
    await runAfterCallbacks();

    expect(nvidiaCalls()).toHaveLength(1);
    expect(jobs.only()).toMatchObject({ status: "completed", attempts: 1, model: "z-ai/glm-5.3" });
    expect((jobs.only().result as { brand_name: string }).brand_name).toBe("Acme");
    // The worker never writes onboarding answers.
    expect(h.saveOnboardingProgress).not.toHaveBeenCalled();
  });

  it("persists a retry for the cron when the fast-path attempt times out (no in-process retry)", async () => {
    nvidiaReply = () => nvidiaResponse({ error: "timed out" }, 408);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    await runWebsiteAnalysis(SITE_URL);
    await runAfterCallbacks();

    expect(nvidiaCalls()).toHaveLength(1);
    expect(jobs.only()).toMatchObject({ status: "queued", attempts: 1, error_code: "timeout" });
  });

  it("does not queue or run a second analysis when the same URL is submitted again", async () => {
    await runWebsiteAnalysis(SITE_URL);
    const second = await runWebsiteAnalysis(`${SITE_URL}/`);

    expect(second).toEqual({ ok: true, status: "queued" });
    expect(jobs.rows.size).toBe(1);
    // Re-arming the fast path is harmless: the atomic claim admits one worker.
    await runAfterCallbacks();
    expect(nvidiaCalls()).toHaveLength(1);
    expect(h.rateLimitRpc).toHaveBeenCalledTimes(2); // one per-action + one daily check, once
  });

  it("checks the per-user website-analysis limit and daily budget when queueing", async () => {
    await runWebsiteAnalysis(SITE_URL);

    const keys = h.rateLimitRpc.mock.calls.map(([, args]) => args.p_key);
    expect(keys[0]).toBe(`onboarding.website_analysis:${USER_ID}`);
    expect(keys[1]).toMatch(new RegExp(`^ai\\.daily\\.\\d{4}-\\d{2}-\\d{2}:${USER_ID}$`));
  });

  it("returns a rate-limit message and queues nothing when the limit is hit", async () => {
    h.rateLimitRpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: null }],
      error: null,
    });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/too quickly/i);
    expect(jobs.rows.size).toBe(0);
    expect(h.afterCallbacks).toHaveLength(0);
  });

  it("fails closed (nothing queued) when the limiter itself errors", async () => {
    h.rateLimitRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/temporarily unavailable/i);
    expect(jobs.rows.size).toBe(0);
  });

  it("keeps the inline unreadable-site message and queues nothing", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("We couldn't read your website");
    expect(jobs.rows.size).toBe(0);
  });

  it("fails safe with the manual-continue message when the job can't be created", async () => {
    h.jobs = {
      from: () => {
        throw new Error('relation "architecta_website_analyses" does not exist');
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({
      ok: false,
      error: "We couldn't analyze your website automatically. You can try again or continue manually.",
    });
  });

  it("rejects unauthenticated callers before any network call", async () => {
    mockSupabase({ user: null });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* =======================================================
   Redaction + static guard
======================================================= */

describe("redactSecrets", () => {
  it("scrubs OpenAI/NVIDIA keys and bearer tokens", () => {
    const out = redactSecrets(
      `Incorrect API key provided: sk-proj-****abcd. key=${FAKE_NVIDIA_KEY} Authorization: Bearer abc.def-123`
    );
    expect(out).not.toContain("sk-proj");
    expect(out).not.toContain(FAKE_NVIDIA_KEY);
    expect(out).not.toContain("abc.def-123");
    expect(out).toContain("Incorrect API key provided");
  });
});

describe("website-analysis path has no OpenAI dependency", () => {
  it("source files in the path do not reference OpenAI", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      path.resolve(__dirname, "./website-analysis.ts"),
      path.resolve(__dirname, "./website-analysis-jobs.ts"),
      path.resolve(__dirname, "./website-step-flow.ts"),
      path.resolve(__dirname, "../ai/llm/providers/nvidia.ts"),
    ];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("api.openai.com");
      expect(content).not.toContain("OPENAI_API_KEY");
      expect(content).not.toMatch(/from ["']openai["']/);
    }
  });
});
