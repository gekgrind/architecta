import { describe, expect, it, vi } from "vitest";

import { composePostText } from "@/lib/publishing/post-text";
import { matchesSavedPost, savePostContent, type SavedPost } from "./save-post-content";

const saved: SavedPost = {
  id: "post-1",
  hook: "Hook.",
  caption: "Caption.",
  body: "Caption.",
  cta: null,
  hashtags: [],
};

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("savePostContent", () => {
  it("PATCHes the edited content and returns the server's saved row", async () => {
    const serverRow = { ...saved, caption: "Edited.", body: "Edited." };
    const fetchImpl = vi.fn(async () => response(200, { ok: true, data: { post: serverRow } }));

    const result = await savePostContent({
      postId: "post-1",
      content: "Hook.\n\nEdited.",
      saved,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, post: serverRow });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/posts/post-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toMatchObject({ hook: "Hook.", caption: "Edited." });
  });

  it("reports the server's error instead of success when persistence fails", async () => {
    const fetchImpl = vi.fn(async () =>
      response(500, { ok: false, error: { code: "server_error", message: "db down" } })
    );
    const result = await savePostContent({
      postId: "post-1",
      content: "Hook.\n\nEdited.",
      saved,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, error: "db down" });
  });

  it("never throws on a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await savePostContent({
      postId: "post-1",
      content: "x",
      saved,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, error: "Failed to fetch" });
  });

  it("treats a 200 without a saved post as a failure", async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: true, data: {} }));
    const result = await savePostContent({
      postId: "post-1",
      content: "x",
      saved,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
  });
});

describe("matchesSavedPost (drives the Saved! state)", () => {
  it("is true only when the editor matches the server-confirmed post", () => {
    expect(matchesSavedPost(composePostText(saved), saved)).toBe(true);
    expect(matchesSavedPost(`${composePostText(saved)} more`, saved)).toBe(false);
    expect(matchesSavedPost(composePostText(saved), null)).toBe(false);
  });
});
