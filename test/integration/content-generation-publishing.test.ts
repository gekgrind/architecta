import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeSupabase } from "../fake-supabase";

/**
 * Cross-workstream coverage for the launch-critical integration:
 *
 *   #10 AI guardrails (NVIDIA-only generation, rate limit + daily budget)
 *   #11 content persistence + scheduling/publishing integrity
 *
 * A post is generated through the real POST /api/posts → gateway → router →
 * NVIDIA client path, then edited, saved, scheduled and published through the
 * real route handlers and publish worker against an in-memory database.
 * Only auth, the Supabase clients, usage logging, the rate-limit RPC, the
 * platform adapter and the network are doubled. No live provider or
 * platform is ever reached.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("../fake-supabase").makeFakeSupabase>,
  publish: vi.fn(),
  rateLimitRpc: vi.fn(),
  logLlmCall: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUser: async () => ({ user: { id: "user-1" } }),
}));
/**
 * The in-memory fake generates non-UUID ids; API schemas require UUIDs, so
 * posts created by the generate route get a real UUID like Postgres would.
 */
function dbClient() {
  const base = h.db.client as unknown as { from: (t: string) => Record<string, unknown> };
  return {
    from(table: string) {
      const q = base.from(table);
      if (table === "architecta_posts") {
        const insert = q.insert as (v: Record<string, unknown>) => unknown;
        q.insert = (v: Record<string, unknown>) => insert({ id: crypto.randomUUID(), ...v });
      }
      return q;
    },
    rpc: h.rateLimitRpc,
  };
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => dbClient() }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: async () => dbClient() }));
vi.mock("@/lib/ai/llm/usage/logger", () => ({ logLlmCall: h.logLlmCall }));
vi.mock("@/lib/publishing/registry", () => ({
  getAdapter: () => ({ publish: h.publish }),
  isPlatformId: (p: string) => p === "linkedin",
}));
vi.mock("@/lib/publishing/connections", () => ({
  CONNECTIONS_TABLE: "architecta_platform_connections",
  getDecryptedTokens: () => ({ accessToken: "tok", refreshToken: null }),
}));

import { POST as generatePost } from "@/app/api/posts/route";
import { GET as getPost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as createCalendarItem } from "@/app/api/calendar/route";
import { DELETE as deleteCalendarItem } from "@/app/api/calendar/[id]/route";
import { POST as runCronRoute } from "@/app/api/cron/publish/route";
import { savePostContent } from "@/components/generate/save-post-content";
import { composePostText } from "@/lib/publishing/post-text";

const SECRET = "cron-secret";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NOW = "2026-10-01T09:00:00.000Z";
const T1 = "2026-10-01T10:00:00.000Z";
const AFTER_T1 = "2026-10-01T10:05:00.000Z";

const GENERATED = {
  title: "Growth systems",
  hook: "Most founders post and pray.",
  caption: "Original generated caption.",
  body: "Original generated caption.",
  hashtags: ["growth", "founders"],
  cta: "Follow for more.",
};

const EDITED_TEXT = [
  "Most founders post and pray.",
  "Edited by the founder: build a system, not a streak.",
  "Follow for more.",
  "#growth #founders",
].join("\n\n");

const fetchMock = vi.fn();

function nvidiaCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url) === NVIDIA_URL);
}

function paidProviderCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    /api\.openai\.com|api\.anthropic\.com/.test(String(url))
  );
}

function seed(extraPosts: Row[] = []) {
  h.db = makeFakeSupabase({
    architecta_posts: extraPosts,
    architecta_content_calendar_items: [],
    architecta_publish_log: [],
    architecta_platform_connections: [
      {
        id: "conn-1",
        user_id: "user-1",
        platform: "linkedin",
        status: "connected",
        external_account_id: "member-1",
        expires_at: null,
      },
    ],
    // A historical settings row pinned to Anthropic.
    architecta_user_settings: [{ user_id: "user-1", text_provider: "anthropic" }],
  });
}

const posts = () => h.db.tables.architecta_posts;
const postById = (id: string) => posts().find((r) => r.id === id)!;
const calendarItems = () => h.db.tables.architecta_content_calendar_items;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function generate() {
  return generatePost(
    new Request("http://localhost/api/posts", jsonInit("POST", { platform: "linkedin", topic: "Growth systems" }))
  );
}

const fetchViaRoutes = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const match = url.match(/^\/api\/posts\/([^/]+)$/);
  if (!match || init?.method !== "PATCH") throw new Error(`Unexpected fetch ${init?.method} ${url}`);
  return patchPost(new Request(`http://localhost${url}`, init), ctx(match[1]));
}) as unknown as typeof fetch;

async function schedule(postId: string, scheduledFor: string) {
  const res = await createCalendarItem(
    new Request(
      "http://localhost/api/calendar",
      jsonInit("POST", { postId, platform: "linkedin", scheduledFor, status: "scheduled" })
    )
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { item: { id: string } } }).data.item.id;
}

async function runCronAt(iso: string) {
  vi.setSystemTime(new Date(iso));
  const res = await runCronRoute(
    new Request("http://localhost/api/cron/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
    })
  );
  return (await res.json()) as { data: { published: number; scanned: number } };
}

async function generateEditSave() {
  const res = await generate();
  expect(res.status).toBe(200);
  const postId = ((await res.json()) as { data: { post: { id: string } } }).data.post.id;

  const saved = await savePostContent({
    postId,
    content: EDITED_TEXT,
    saved: postById(postId) as never,
    fetchImpl: fetchViaRoutes,
  });
  expect(saved.ok).toBe(true);
  return postId;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("AI_TEST_PROVIDER", "nvidia");
  vi.stubEnv("NVIDIA_API_KEY", "nvapi-FAKE-TEST-KEY");
  vi.stubEnv("OPENAI_API_KEY", "sk-FAKE-TEST-KEY");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-FAKE-TEST-KEY");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: string | URL) => {
    if (String(input) === NVIDIA_URL) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(GENERATED) } }],
          usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response("unexpected outbound call", { status: 500 });
  });
  h.rateLimitRpc.mockReset();
  h.rateLimitRpc.mockResolvedValue({ data: [{ allowed: true, remaining: 10, reset_at: null }], error: null });
  h.publish.mockReset();
  h.publish.mockResolvedValue({ externalPostId: "urn:li:share:1", externalUrl: "https://li/1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  seed();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Generate → edit → save → schedule → publish (Scenario D)", () => {
  it("generates on NVIDIA only, and the worker publishes the persisted edit", async () => {
    const postId = await generateEditSave();

    expect(nvidiaCalls()).toHaveLength(1);
    expect(paidProviderCalls()).toHaveLength(0);
    expect(postById(postId)).toMatchObject({ ai_provider: "nvidia", status: "draft" });

    // Reload returns the saved edit.
    const reload = await getPost(new Request(`http://localhost/api/posts/${postId}`), ctx(postId));
    const body = (await reload.json()) as { data: { post: Row } };
    expect(composePostText(body.data.post as never)).toBe(EDITED_TEXT);

    await schedule(postId, T1);
    const run = await runCronAt(AFTER_T1);

    expect(run.data.published).toBe(1);
    expect(h.publish).toHaveBeenCalledTimes(1);
    expect((h.publish.mock.calls[0][0] as { text: string }).text).toBe(EDITED_TEXT);
    expect(postById(postId).status).toBe("published");

    // Published posts are not re-armed by a second worker pass.
    await runCronAt("2026-10-01T11:00:00.000Z");
    expect(h.publish).toHaveBeenCalledTimes(1);
  });
});

describe("Save then unschedule (Scenario E)", () => {
  it("keeps the saved edit but leaves nothing the worker can claim", async () => {
    const postId = await generateEditSave();
    const itemId = await schedule(postId, T1);

    const res = await deleteCalendarItem(
      new Request(`http://localhost/api/calendar/${itemId}`, { method: "DELETE" }),
      ctx(itemId)
    );
    expect(res.status).toBe(200);

    expect(postById(postId)).toMatchObject({ status: "draft", scheduled_for: null });
    expect(composePostText(postById(postId) as never)).toBe(EDITED_TEXT);

    const run = await runCronAt(AFTER_T1);
    expect(run.data.scanned).toBe(0);
    expect(h.publish).not.toHaveBeenCalled();
  });
});

describe("AI budget exhaustion during content generation (Scenario F)", () => {
  it("returns a controlled limit response with no provider call and leaves posts/calendar untouched", async () => {
    const postId = await generateEditSave();
    await schedule(postId, T1);
    const postsBefore = structuredClone(posts());
    const calendarBefore = structuredClone(calendarItems());
    fetchMock.mockClear();

    // Per-action limit still has room; the daily budget is spent.
    h.rateLimitRpc.mockImplementation(async (_fn: string, args: { p_key: string }) => ({
      data: [{ allowed: !args.p_key.startsWith("ai.daily."), remaining: 0, reset_at: null }],
      error: null,
    }));

    const res = await generate();

    expect(res.status).toBe(429);
    expect(nvidiaCalls()).toHaveLength(0);
    expect(paidProviderCalls()).toHaveLength(0);
    expect(posts()).toEqual(postsBefore);
    expect(calendarItems()).toEqual(calendarBefore);

    // The already-scheduled, edited post still publishes as saved.
    await runCronAt(AFTER_T1);
    expect((h.publish.mock.calls[0][0] as { text: string }).text).toBe(EDITED_TEXT);
  });

  it("fails closed (no provider call, nothing written) when the limiter errors", async () => {
    h.rateLimitRpc.mockResolvedValue({ data: null, error: { message: "db down" } });

    const res = await generate();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
  });
});
