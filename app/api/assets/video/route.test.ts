import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  generateVideo: vi.fn(),
  getUserAiPreference: vi.fn(),
  runGateway: vi.fn(),
  extractJson: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: h.enforceRateLimit,
  RATE_LIMITS: { videoGenerate: { action: "assets.video", limit: 5, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/preferences", () => ({ getUserAiPreference: h.getUserAiPreference }));
vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/ai/llm/json", () => ({ extractJson: h.extractJson }));
vi.mock("@/lib/ai/llm/providers/openai-video", () => {
  class VideoNotAvailableError extends Error {
    status: number;
    raw: unknown;
    constructor(message: string, status: number, raw: unknown) {
      super(message);
      this.name = "VideoNotAvailableError";
      this.status = status;
      this.raw = raw;
    }
  }
  return {
    VideoNotAvailableError,
    generateVideo: h.generateVideo,
    buildStoryboardPrompt: vi.fn(() => "STORY_PROMPT"),
  };
});

import { POST } from "./route";
import { VideoNotAvailableError } from "@/lib/ai/llm/providers/openai-video";

const USER_ID = "user-vid";

function makeSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  const insertCalls: unknown[] = [];
  const uploads: Array<{ path: string }> = [];
  function makeQuery(table: string) {
    const result = () => resultByTable[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      insert: (rows: unknown) => {
        insertCalls.push(rows);
        return q;
      },
      update: () => q,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onF, onR),
    });
    return q;
  }
  const storage = {
    from: () => ({
      upload: (path: string) => {
        uploads.push({ path });
        return Promise.resolve({ error: null });
      },
      createSignedUrl: () =>
        Promise.resolve({ data: { signedUrl: "https://signed/vid" }, error: null }),
      remove: () => Promise.resolve({ error: null }),
    }),
  };
  return { from: (t: string) => makeQuery(t), storage, insertCalls, uploads };
}

function req(body: unknown) {
  return new Request("http://localhost/api/assets/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.enforceRateLimit.mockResolvedValue(null);
  h.getUserAiPreference.mockResolvedValue({ openaiVideoModel: null });
});

describe("POST /api/assets/video", () => {
  it("401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(req({ prompt: "a clip" }))).status).toBe(401);
  });

  it("429 when rate limited, before generation", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.enforceRateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    const res = await POST(req({ prompt: "a clip" }));
    expect(res.status).toBe(429);
    expect(h.generateVideo).not.toHaveBeenCalled();
  });

  it("422 for an empty prompt", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    expect((await POST(req({ prompt: "" }))).status).toBe(422);
  });

  it("returns a ready video when Sora succeeds", async () => {
    const supabase = makeSupabase({
      architecta_generated_assets: {
        data: {
          id: "vid-1",
          provider: "openai",
          model: "sora-2",
          prompt: "a clip",
          storage_bucket: "architecta-assets",
          storage_path: `${USER_ID}/vid-1.mp4`,
          duration_seconds: 8,
          post_id: null,
          created_at: "2026-06-23T00:00:00Z",
        },
        error: null,
      },
    });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.generateVideo.mockResolvedValue({
      provider: "openai",
      model: "sora-2",
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "video/mp4",
      durationSeconds: 8,
      latencyMs: 100,
      requestId: "req-vid",
    });

    const res = await POST(req({ prompt: "a clip" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { asset: { id: string; status: string } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.asset.status).toBe("ready");
    expect(supabase.uploads[0].path.endsWith(".mp4")).toBe(true);
    expect(h.runGateway).not.toHaveBeenCalled();
  });

  it("falls back to a storyboard when Sora is unavailable", async () => {
    const supabase = makeSupabase({
      architecta_generated_assets: {
        data: {
          id: "sb-1",
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          prompt: "a clip",
          storage_bucket: "architecta-assets",
          storage_path: `${USER_ID}/sb-1.storyboard.json`,
          duration_seconds: 8,
          post_id: null,
          created_at: "2026-06-23T00:00:00Z",
        },
        error: null,
      },
    });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.generateVideo.mockRejectedValue(new VideoNotAvailableError("no sora", 503, null));
    h.runGateway.mockResolvedValue({
      text: "{}",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    h.extractJson.mockReturnValue({
      summary: "A short clip",
      shots: [{ index: 1, durationSeconds: 8, visual: "wide shot" }],
      totalDurationSeconds: 8,
      recommendedAspectRatio: "9:16",
    });

    const res = await POST(req({ prompt: "a clip" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { asset: { status: string; storyboard: { summary: string } } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.asset.status).toBe("storyboard");
    expect(body.data.asset.storyboard.summary).toBe("A short clip");
    expect(supabase.uploads[0].path.endsWith(".storyboard.json")).toBe(true);

    const inserted = supabase.insertCalls[0] as {
      user_id: string;
      asset_type: string;
      meta: { status: string };
    };
    expect(inserted.user_id).toBe(USER_ID);
    expect(inserted.asset_type).toBe("video");
    expect(inserted.meta.status).toBe("storyboard");
  });
});
