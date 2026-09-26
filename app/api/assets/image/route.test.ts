import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  enforceAiUsage: vi.fn(),
  generateImage: vi.fn(),
  getUserAiPreference: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: h.getAuthenticatedUser }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  enforceAiUsage: h.enforceAiUsage,
  RATE_LIMITS: { imageGenerate: { action: "assets.image", limit: 10, windowSeconds: 60 } },
}));
vi.mock("@/lib/ai/llm/providers/openai-images", () => ({
  generateImage: h.generateImage,
  ImageGenerationUnavailableError: class ImageGenerationUnavailableError extends Error {},
}));
vi.mock("@/lib/ai/llm/preferences", () => ({ getUserAiPreference: h.getUserAiPreference }));

import { POST } from "./route";

const USER_ID = "user-img";
const POST_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Mock with a table query surface + a storage surface. Tables resolve from
 * resultByTable; storage.upload/createSignedUrl/remove are spies.
 */
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
        Promise.resolve({ data: { signedUrl: "https://signed/img" }, error: null }),
      remove: () => Promise.resolve({ error: null }),
    }),
  };
  return { from: (t: string) => makeQuery(t), storage, insertCalls, uploads };
}

function req(body: unknown) {
  return new Request("http://localhost/api/assets/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(h).forEach((m) => "mockReset" in m && m.mockReset());
  h.enforceAiUsage.mockResolvedValue(null);
  h.getUserAiPreference.mockResolvedValue({ openaiImageModel: "gpt-image-1" });
  vi.stubEnv("AI_TEST_PROVIDER", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/assets/image in NVIDIA-only test mode", () => {
  it("returns a controlled 503 and never generates or spends budget", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "nvidia");
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });

    const res = await POST(req({ prompt: "a cat" }));

    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toMatch(/test mode/i);
    expect(h.generateImage).not.toHaveBeenCalled();
    expect(h.enforceAiUsage).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted model with 422 before generation", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(req({ prompt: "a cat", model: "gpt-image-99" }));
    expect(res.status).toBe(422);
    expect(h.generateImage).not.toHaveBeenCalled();
  });
});

describe("POST /api/assets/image", () => {
  it("401 when unauthenticated", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(req({ prompt: "a cat" }))).status).toBe(401);
  });

  it("429 when rate limited, before generation", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.enforceAiUsage.mockResolvedValue(new Response("{}", { status: 429 }));
    const res = await POST(req({ prompt: "a cat" }));
    expect(res.status).toBe(429);
    expect(h.generateImage).not.toHaveBeenCalled();
  });

  it("422 for an empty prompt", async () => {
    h.createSupabaseServerClient.mockResolvedValue({});
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(req({ prompt: "" }));
    expect(res.status).toBe(422);
  });

  it("404 when the referenced post is not owned by the user", async () => {
    const supabase = makeSupabase({ architecta_posts: { data: null, error: null } });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    const res = await POST(req({ prompt: "a cat", postId: POST_ID }));
    expect(res.status).toBe(404);
    expect(h.generateImage).not.toHaveBeenCalled();
  });

  it("generates, uploads under the user's folder, and inserts an asset row", async () => {
    const supabase = makeSupabase({
      architecta_generated_assets: {
        data: {
          id: "asset-1",
          provider: "openai",
          model: "gpt-image-1",
          prompt: "a cat",
          storage_bucket: "architecta-assets",
          storage_path: `${USER_ID}/asset-1.png`,
          width: 1024,
          height: 1024,
          post_id: null,
          created_at: "2026-06-23T00:00:00Z",
        },
        error: null,
      },
    });
    h.createSupabaseServerClient.mockResolvedValue(supabase);
    h.getAuthenticatedUser.mockResolvedValue({ user: { id: USER_ID } });
    h.generateImage.mockResolvedValue({
      provider: "openai",
      model: "gpt-image-1",
      base64: Buffer.from("png").toString("base64"),
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      latencyMs: 10,
      requestId: "req-1",
    });

    const res = await POST(req({ prompt: "a cat" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { asset: { id: string; signedUrl: string } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.asset.id).toBe("asset-1");
    expect(body.data.asset.signedUrl).toBe("https://signed/img");

    // Uploaded under "<user_id>/..." so storage RLS matches the prefix.
    expect(supabase.uploads[0].path.startsWith(`${USER_ID}/`)).toBe(true);
    const inserted = supabase.insertCalls[0] as { user_id: string; asset_type: string };
    expect(inserted.user_id).toBe(USER_ID);
    expect(inserted.asset_type).toBe("image");
  });
});
