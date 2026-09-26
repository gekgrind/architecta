import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeSupabase } from "./fake-supabase";

/**
 * Phase 3 lifecycle regression tests:
 * Generate → Edit → Save → Reload → Schedule → Reschedule/Unschedule/Delete → Publish,
 * driven through the real route handlers and publish worker against an
 * in-memory database. Only auth, the Supabase client and the platform adapter
 * are stubbed — nothing is sent to a real platform.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  db: null as unknown as ReturnType<typeof import("./fake-supabase").makeFakeSupabase>,
  fail: (() => false) as (table: string, op: string, values: Record<string, unknown>) => boolean,
  publish: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUser: async () => (h.userId ? { user: { id: h.userId } } : null),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => h.db.client }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: async () => h.db.client }));
vi.mock("@/lib/publishing/registry", () => ({
  getAdapter: () => ({ publish: h.publish }),
  isPlatformId: (p: string) => p === "linkedin",
}));
vi.mock("@/lib/publishing/connections", () => ({
  CONNECTIONS_TABLE: "architecta_platform_connections",
  getDecryptedTokens: () => ({ accessToken: "tok", refreshToken: null }),
}));

import { GET as getPost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as createCalendarItem } from "@/app/api/calendar/route";
import {
  DELETE as deleteCalendarItem,
  PATCH as patchCalendarItem,
} from "@/app/api/calendar/[id]/route";
import { POST as runCronRoute } from "@/app/api/cron/publish/route";
import { savePostContent } from "@/components/generate/save-post-content";
import { composePostText } from "@/lib/publishing/post-text";

const SECRET = "cron-secret";
const POST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_POST_ID = "22222222-2222-4222-8222-222222222222";

const NOW = "2026-10-01T09:00:00.000Z";
const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-02T10:00:00.000Z";
const AFTER_T1 = "2026-10-01T10:05:00.000Z";
const AFTER_T2 = "2026-10-02T10:05:00.000Z";

const generatedPost = (over: Row = {}): Row => ({
  id: POST_ID,
  user_id: "user-1",
  platform: "linkedin",
  title: "Growth systems",
  hook: "Most founders post and pray.",
  caption: "Original generated caption.",
  body: "Original generated caption.",
  cta: "Follow for more.",
  hashtags: ["growth", "founders"],
  status: "draft",
  scheduled_for: null,
  published_at: null,
  publish_attempts: 0,
  image_asset_id: null,
  video_asset_id: null,
  meta: {},
  ...over,
});

const ORIGINAL_TEXT = composePostText(generatedPost() as never);
const EDITED_TEXT = [
  "Most founders post and pray.",
  "Edited by the founder: build a system, not a streak.",
  "Follow for more.",
  "#growth #founders",
].join("\n\n");

function seed(posts: Row[] = [generatedPost()]) {
  h.db = makeFakeSupabase(
    {
      architecta_posts: posts,
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
    },
    (table, op, values) => h.fail(table, op, values)
  );
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const post = (id = POST_ID) => h.db.tables.architecta_posts.find((r) => r.id === id)!;
const calendarItems = () => h.db.tables.architecta_content_calendar_items;

/** Routes the client's fetch through the real PATCH handler (the Generate Save path). */
const fetchViaRoutes = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const match = url.match(/^\/api\/posts\/([^/]+)$/);
  if (!match || init?.method !== "PATCH") throw new Error(`Unexpected fetch ${init?.method} ${url}`);
  return patchPost(new Request(`http://localhost${url}`, init), ctx(match[1]));
}) as unknown as typeof fetch;

async function saveEdit(content: string) {
  return savePostContent({
    postId: POST_ID,
    content,
    saved: post() as never,
    fetchImpl: fetchViaRoutes,
  });
}

async function reloadPost(id = POST_ID) {
  const res = await getPost(new Request(`http://localhost/api/posts/${id}`), ctx(id));
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { post: Row } } };
}

async function schedule(scheduledFor: string, postId = POST_ID) {
  return createCalendarItem(
    new Request(
      "http://localhost/api/calendar",
      jsonInit("POST", { postId, platform: "linkedin", scheduledFor, status: "scheduled" })
    )
  );
}

async function patchItem(id: string, body: unknown) {
  return patchCalendarItem(new Request(`http://localhost/api/calendar/${id}`, jsonInit("PATCH", body)), ctx(id));
}

async function deleteItem(id: string) {
  return deleteCalendarItem(new Request(`http://localhost/api/calendar/${id}`, { method: "DELETE" }), ctx(id));
}

/** Run the scheduled-publish worker at a given wall-clock time. */
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

async function scheduleOk(when: string) {
  const res = await schedule(when);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { item: { id: string } } }).data.item.id;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  process.env.CRON_SECRET = SECRET;
  h.userId = "user-1";
  h.fail = () => false;
  h.publish.mockReset();
  h.publish.mockResolvedValue({ externalPostId: "urn:li:share:1", externalUrl: "https://li/1" });
  vi.mocked(fetchViaRoutes).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Generate Save persists edits", () => {
  it("Edit → Save sends the edited content to PATCH /api/posts/[id] and persists it", async () => {
    const result = await saveEdit(EDITED_TEXT);

    expect(result.ok).toBe(true);
    expect(fetchViaRoutes).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchViaRoutes).mock.calls[0];
    expect(url).toBe(`/api/posts/${POST_ID}`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body)).caption).toBe(
      "Edited by the founder: build a system, not a streak."
    );
    // Untouched hook / CTA / hashtags stay structured fields.
    expect(post()).toMatchObject({
      hook: "Most founders post and pray.",
      caption: "Edited by the founder: build a system, not a streak.",
      body: "Edited by the founder: build a system, not a streak.",
      cta: "Follow for more.",
      hashtags: ["growth", "founders"],
    });
  });

  it("Save → Reload: a refetch returns the edited version, not the generated draft", async () => {
    await saveEdit(EDITED_TEXT);

    const { status, body } = await reloadPost();
    expect(status).toBe(200);
    expect(composePostText(body.data!.post as never)).toBe(EDITED_TEXT);
    expect(composePostText(body.data!.post as never)).not.toBe(ORIGINAL_TEXT);
  });

  it("a free-form edit (hook rewritten) still reloads exactly as typed", async () => {
    const freeform = "A brand new opening line.\n\nAnd a rewritten body.\n\n#growth #founders";
    expect((await saveEdit(freeform)).ok).toBe(true);
    const { body } = await reloadPost();
    expect(composePostText(body.data!.post as never)).toBe(freeform);
  });

  it("Save failure reports an error and leaves the stored post untouched", async () => {
    h.fail = (table, op) => table === "architecta_posts" && op === "update";

    const result = await saveEdit(EDITED_TEXT);

    expect(result).toEqual({ ok: false, error: "db down" });
    const { body } = await reloadPost();
    expect(composePostText(body.data!.post as never)).toBe(ORIGINAL_TEXT);
  });

  it("the publishing layer receives the saved edit, not the original generated draft", async () => {
    await saveEdit(EDITED_TEXT);
    await scheduleOk(T1);

    await runCronAt(AFTER_T1);

    expect(h.publish).toHaveBeenCalledTimes(1);
    const sent = h.publish.mock.calls[0][0] as { text: string };
    expect(sent.text).toBe(EDITED_TEXT);
    expect(sent.text).not.toContain("Original generated caption");
  });
});

describe("Calendar scheduling updates the post the worker reads", () => {
  it("Schedule sets the calendar item and the post (status + scheduled_for)", async () => {
    const itemId = await scheduleOk(T1);

    expect(calendarItems()).toHaveLength(1);
    expect(calendarItems()[0]).toMatchObject({ id: itemId, post_id: POST_ID, scheduled_for: T1, status: "scheduled" });
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T1 });
  });

  it("Schedule does not report success when the post update fails, and leaves no orphan calendar item", async () => {
    h.fail = (table, op) => table === "architecta_posts" && op === "update";

    const res = await schedule(T1);

    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
    expect(calendarItems()).toHaveLength(0);
    expect(post()).toMatchObject({ status: "draft", scheduled_for: null });
  });

  it("Deleting a scheduled item unschedules the post so the worker cannot publish it", async () => {
    const itemId = await scheduleOk(T1);

    const res = await deleteItem(itemId);

    expect(res.status).toBe(200);
    expect(calendarItems()).toHaveLength(0);
    expect(post()).toMatchObject({ status: "draft", scheduled_for: null });
    const run = await runCronAt(AFTER_T1);
    expect(run.data.scanned).toBe(0);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("Unscheduling via status change has the same safety invariant", async () => {
    const itemId = await scheduleOk(T1);

    const res = await patchItem(itemId, { status: "draft" });

    expect(res.status).toBe(200);
    expect(calendarItems()[0]).toMatchObject({ status: "draft" });
    expect(post()).toMatchObject({ status: "draft", scheduled_for: null });
    await runCronAt(AFTER_T1);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("Reschedule: one effective schedule, new time persisted, old time no longer publishable", async () => {
    const itemId = await scheduleOk(T1);

    const res = await patchItem(itemId, { scheduledFor: T2 });

    expect(res.status).toBe(200);
    expect(calendarItems()).toHaveLength(1);
    expect(calendarItems()[0]).toMatchObject({ scheduled_for: T2, status: "scheduled" });
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T2 });

    await runCronAt(AFTER_T1);
    expect(h.publish).not.toHaveBeenCalled();

    await runCronAt(AFTER_T2);
    expect(h.publish).toHaveBeenCalledTimes(1);
  });

  it("Reschedule failure on the post restores the calendar so the UI matches the real schedule", async () => {
    const itemId = await scheduleOk(T1);
    h.fail = (table, op) => table === "architecta_posts" && op === "update";

    const res = await patchItem(itemId, { scheduledFor: T2 });

    expect(res.status).toBe(500);
    expect(calendarItems()[0]).toMatchObject({ scheduled_for: T1, status: "scheduled" });
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T1 });
  });

  it("Scheduling a post again reuses its calendar item instead of creating a duplicate", async () => {
    const itemId = await scheduleOk(T1);
    await patchItem(itemId, { status: "draft" });

    const againId = await scheduleOk(T2);

    expect(againId).toBe(itemId);
    expect(calendarItems()).toHaveLength(1);
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T2 });
  });
});

describe("Delete / unschedule partial failures fail safely", () => {
  it("post update fails → error, nothing deleted, calendar and post still agree", async () => {
    const itemId = await scheduleOk(T1);
    h.fail = (table, op) => table === "architecta_posts" && op === "update";

    const res = await deleteItem(itemId);

    expect(res.status).toBe(500);
    expect(calendarItems()).toHaveLength(1);
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T1 });
  });

  it("calendar delete fails after the post was unscheduled → error, and the post is still not publishable", async () => {
    const itemId = await scheduleOk(T1);
    h.fail = (table, op) => table === "architecta_content_calendar_items" && op === "delete";

    const res = await deleteItem(itemId);

    expect(res.status).toBe(500);
    expect(post()).toMatchObject({ status: "draft", scheduled_for: null });
    h.fail = () => false;
    await runCronAt(AFTER_T1);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("status-change unschedule: post update fails → error and the calendar still shows it scheduled", async () => {
    const itemId = await scheduleOk(T1);
    h.fail = (table, op) => table === "architecta_posts" && op === "update";

    const res = await patchItem(itemId, { status: "draft" });

    expect(res.status).toBe(500);
    expect(calendarItems()[0]).toMatchObject({ status: "scheduled" });
    expect(post()).toMatchObject({ status: "scheduled" });
  });

  it("refuses to report a post as unscheduled while it is mid-publish", async () => {
    const itemId = await scheduleOk(T1);
    post().status = "publishing";

    const res = await deleteItem(itemId);

    expect(res.status).toBe(409);
    expect(calendarItems()).toHaveLength(1);
  });
});

describe("Publish worker eligibility", () => {
  it("scheduled → eligible once its time arrives (not before)", async () => {
    await scheduleOk(T1);
    await runCronAt(NOW);
    expect(h.publish).not.toHaveBeenCalled();
    await runCronAt(AFTER_T1);
    expect(h.publish).toHaveBeenCalledTimes(1);
    expect(post()).toMatchObject({ status: "published" });
    expect(calendarItems()[0]).toMatchObject({ status: "published" });
  });

  it("draft → not eligible", async () => {
    await runCronAt(AFTER_T2);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("published → not eligible again, and cannot be re-armed from the calendar", async () => {
    const itemId = await scheduleOk(T1);
    await runCronAt(AFTER_T1);
    expect(h.publish).toHaveBeenCalledTimes(1);

    const rearm = await patchItem(itemId, { status: "scheduled", scheduledFor: T2 });
    expect(rearm.status).toBe(409);
    expect(post()).toMatchObject({ status: "published" });

    await runCronAt(AFTER_T2);
    expect(h.publish).toHaveBeenCalledTimes(1);
  });
});

describe("Authorization: every write is scoped to the signed-in user", () => {
  it("rejects unauthenticated edits, schedules and deletes", async () => {
    h.userId = null;
    expect((await saveEdit(EDITED_TEXT)).ok).toBe(false);
    expect((await schedule(T1)).status).toBe(401);
    expect((await patchItem("any", { status: "draft" })).status).toBe(401);
    expect((await deleteItem("any")).status).toBe(401);
  });

  it("another user cannot edit my post", async () => {
    h.userId = "user-2";
    const result = await saveEdit(EDITED_TEXT);
    expect(result.ok).toBe(false);
    expect(post()).toMatchObject({ caption: "Original generated caption." });
  });

  it("another user cannot schedule my post (and no calendar item is left behind)", async () => {
    h.userId = "user-2";
    const res = await schedule(T1);
    expect(res.status).toBe(409);
    expect(calendarItems()).toHaveLength(0);
    expect(post()).toMatchObject({ status: "draft", scheduled_for: null });
  });

  it("another user cannot delete or unschedule my calendar item", async () => {
    const itemId = await scheduleOk(T1);
    h.userId = "user-2";

    expect((await deleteItem(itemId)).status).toBe(404);
    expect((await patchItem(itemId, { status: "draft" })).status).toBe(404);
    expect(calendarItems()).toHaveLength(1);
    expect(post()).toMatchObject({ status: "scheduled", scheduled_for: T1 });
  });

  it("another user's post is not affected by my calendar actions", async () => {
    seed([generatedPost(), generatedPost({ id: OTHER_POST_ID, user_id: "user-2", status: "scheduled", scheduled_for: T1 })]);
    const itemId = await scheduleOk(T1);
    await deleteItem(itemId);
    expect(post(OTHER_POST_ID)).toMatchObject({ status: "scheduled", scheduled_for: T1 });
  });
});
