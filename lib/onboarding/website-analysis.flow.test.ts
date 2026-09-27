import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end website-analysis path with only the network and database
 * mocked: runWebsiteAnalysis → analyzeWebsite → runGateway → router →
 * NVIDIA client. No live API calls are made.
 */

const h = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  logLlmCall: vi.fn(),
  getOrCreateArchitectaOnboarding: vi.fn(),
  updateOnboardingStep: vi.fn(),
  saveOnboardingProgress: vi.fn(),
  rateLimitRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(async () => ({ rpc: h.rateLimitRpc })),
}));
vi.mock("@/lib/ai/llm/usage/logger", () => ({ logLlmCall: h.logLlmCall }));
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
import { analyzeWebsite, redactSecrets } from "./website-analysis";
import { WEBSITE_ANALYSIS_FAILED_MESSAGE } from "./website-step-flow";

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
let nvidiaReply: () => Response;

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
  h.getOrCreateArchitectaOnboarding.mockResolvedValue({ session: { id: "sess-1" } });
  h.saveOnboardingProgress.mockResolvedValue({ ok: true });
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
   Success path
======================================================= */

describe("runWebsiteAnalysis — NVIDIA success", () => {
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

  it("analyzes the site via NVIDIA z-ai/glm-5.3 and persists the result", async () => {
    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

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

    // Persisted to onboarding_sessions.answers exactly as downstream steps read it.
    expect(h.saveOnboardingProgress).toHaveBeenCalledWith(
      "sess-1",
      { website_analysis: result.analysis },
      "website"
    );
  });

  it("sends the existing analysis prompt to NVIDIA with the right model and key", async () => {
    await runWebsiteAnalysis(SITE_URL);

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

  it("makes no OpenAI (or other provider) calls, even when the user pinned OpenAI", async () => {
    await runWebsiteAnalysis(SITE_URL);

    const urls = calledUrls();
    expect(urls.some((u) => u.includes("api.openai.com"))).toBe(false);
    expect(urls.some((u) => u.includes("api.anthropic.com"))).toBe(false);
    expect(urls).toEqual([SITE_URL, NVIDIA_URL]);
  });

  it("records usage against the nvidia provider", async () => {
    await runWebsiteAnalysis(SITE_URL);

    expect(h.logLlmCall).toHaveBeenCalledTimes(1);
    expect(h.logLlmCall.mock.calls[0][0].result).toMatchObject({
      provider: "nvidia",
      model: "z-ai/glm-5.3",
      usedFallback: false,
    });
  });
});

/* =======================================================
   Bounded secondary page discovery (end-to-end)
======================================================= */

describe("runWebsiteAnalysis — secondary page discovery", () => {
  const ABOUT_URL = `${SITE_URL}/about`;
  const PRICING_URL = `${SITE_URL}/pricing`;

  const HOMEPAGE_WITH_LINKS = `<html><head><title>Acme Growth Studio</title>
<meta name="description" content="Acme helps B2B founders build repeatable content systems."></head>
<body><h1>Build a growth engine</h1><p>Acme Growth Studio designs content systems for bootstrapped SaaS founders.</p>
<nav><a href="/about">About us</a><a href="/pricing">Pricing</a></nav>
<p>Book a strategy call today.</p></body></html>`;

  const ABOUT_HTML = `<html><body><h1>Our story</h1><p>Founded in 2021 to help SaaS founders skip the growth-marketing guesswork.</p>
<a href="/careers">Careers</a></body></html>`;

  beforeEach(() => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme Growth Studio", "confidence": "high"}');
  });

  it("fetches same-origin About/Pricing pages linked from the homepage and includes them in one model call", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return htmlResponse("<html><body><p>Starter plan: $29/mo.</p></body></html>", url);
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    expect(calledUrls().sort()).toEqual([ABOUT_URL, NVIDIA_URL, PRICING_URL, SITE_URL].sort());

    const body = JSON.parse(nvidiaCalls()[0][1].body);
    const prompt: string = body.messages[1].content;
    expect(prompt).toContain("ABOUT PAGE");
    expect(prompt).toContain("Founded in 2021");
    expect(prompt).toContain("PRICING PAGE");
    expect(prompt).toContain("Starter plan");
    // Still exactly one model call for however many pages were combined.
    expect(nvidiaCalls()).toHaveLength(1);
  });

  it("falls back to homepage-only analysis when a secondary page fails, without failing the whole analysis", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return new Response("not found", { status: 404 });
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    const body = JSON.parse(nvidiaCalls()[0][1].body);
    const prompt: string = body.messages[1].content;
    expect(prompt).toContain("ABOUT PAGE");
    expect(prompt).not.toContain("PRICING PAGE");
  });

  it("still succeeds homepage-only when every secondary page fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      if (url === ABOUT_URL || url === PRICING_URL) throw new TypeError("fetch failed");
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    const body = JSON.parse(nvidiaCalls()[0][1].body);
    expect(body.messages[1].content).toContain("Build a growth engine");
  });

  it("does not recurse into links found on a secondary page", async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) return htmlResponse(HOMEPAGE_WITH_LINKS, url);
      // ABOUT_HTML itself links to /careers — that must never be fetched.
      if (url === ABOUT_URL) return htmlResponse(ABOUT_HTML, url);
      if (url === PRICING_URL) return htmlResponse("<html><body>Pricing</body></html>", url);
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    await runWebsiteAnalysis(SITE_URL);

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
      if (url === NVIDIA_URL) return nvidiaReply();
      return new Response("unexpected outbound call", { status: 500 });
    });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    const body = JSON.parse(nvidiaCalls()[0][1].body);
    expect(body.messages[1].content).not.toContain("Founded in 2021");
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

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
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

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.brand_name).toBe("Model-Extracted Name");
  });
});

/* =======================================================
   Structured output resilience
======================================================= */

describe("analyzeWebsite — output parsing", () => {
  it("accepts bare JSON with missing optional fields without inventing data", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme"}');

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.brand_name).toBe("Acme");
    expect(result.analysis.industry).toBeUndefined();
    expect(result.analysis.topics).toBeUndefined();
    expect(result.analysis.confidence).toBe("low");
  });

  it("keeps list answers for prose fields instead of dropping them", async () => {
    nvidiaReply = () =>
      nvidiaContent('{"brand_name": "Acme", "offers": ["Content system design", "Strategy calls", 7]}');

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.offers).toBe("Content system design; Strategy calls");
  });

  it("returns the safe message when the reply is truncated mid-JSON", async () => {
    nvidiaReply = () =>
      nvidiaResponse({
        choices: [{ message: { content: '```json\n{"brand_name": "Acme", "descr' }, finish_reason: "length" }],
      });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("returns the safe message for malformed JSON", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme", "industry": ');
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("returns the safe message when the model returns no JSON object", async () => {
    nvidiaReply = () => nvidiaContent("<think>thinking…</think>");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("rejects a JSON array instead of an object", async () => {
    nvidiaReply = () => nvidiaContent('["Acme"]');
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });
});

/* =======================================================
   Provider failure sanitization
======================================================= */

describe("runWebsiteAnalysis — NVIDIA failure", () => {
  it("returns a UI-safe error and never leaks keys or provider text", async () => {
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

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });

    const serialized = JSON.stringify(result);
    for (const secret of [LEAKED_OPENAI_KEY, FAKE_NVIDIA_KEY, "sk-proj", "nvapi-", "Incorrect API key"]) {
      expect(serialized).not.toContain(secret);
    }

    // Server log is useful for debugging but scrubbed.
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("401");
    expect(logged).not.toContain(LEAKED_OPENAI_KEY);
    expect(logged).not.toContain(FAKE_NVIDIA_KEY);

    // Auth failures are not retried and do not fall back to another provider.
    expect(nvidiaCalls()).toHaveLength(1);
    expect(calledUrls().some((u) => u.includes("api.openai.com"))).toBe(false);
    expect(h.saveOnboardingProgress).not.toHaveBeenCalled();
  });

  it("returns a UI-safe error when NVIDIA_API_KEY is not configured", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
    expect(calledUrls().some((u) => u.includes("api.openai.com"))).toBe(false);
  });

  it("returns a UI-safe error when persisting the analysis fails", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme"}');
    h.saveOnboardingProgress.mockResolvedValue({ ok: false, error: "db down" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("returns a UI-safe error on unexpected exceptions", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme"}');
    h.getOrCreateArchitectaOnboarding.mockRejectedValue(new Error("boom: internal detail"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: WEBSITE_ANALYSIS_FAILED_MESSAGE });
  });

  it("reports unreachable sites without calling the model", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("We couldn't read your website");
    expect(result.error).toContain("continue manually");
    expect(nvidiaCalls()).toHaveLength(0);
  });

  it("rejects unauthenticated callers before any network call", async () => {
    mockSupabase({ user: null });

    const result = await runWebsiteAnalysis(SITE_URL);

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* =======================================================
   AI rate limit + daily budget
======================================================= */

describe("analyzeWebsite — AI usage limits", () => {
  it("checks the per-user website-analysis limit and daily budget before the model", async () => {
    nvidiaReply = () => nvidiaContent('{"brand_name": "Acme"}');

    await analyzeWebsite(USER_ID, SITE_URL);

    const keys = h.rateLimitRpc.mock.calls.map(([, args]) => args.p_key);
    expect(keys[0]).toBe(`onboarding.website_analysis:${USER_ID}`);
    expect(keys[1]).toMatch(new RegExp(`^ai\\.daily\\.\\d{4}-\\d{2}-\\d{2}:${USER_ID}$`));
  });

  it("returns a rate-limit message and never calls NVIDIA when the limit is hit", async () => {
    h.rateLimitRpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: null }],
      error: null,
    });

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/too quickly/i);
    expect(nvidiaCalls()).toHaveLength(0);
  });

  it("fails closed when the limiter itself errors", async () => {
    h.rateLimitRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await analyzeWebsite(USER_ID, SITE_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/temporarily unavailable/i);
    expect(nvidiaCalls()).toHaveLength(0);
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
