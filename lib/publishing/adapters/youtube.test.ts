import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { youtubeAdapter } from "./youtube";

const REDIRECT = "https://architecta.example/api/connections/youtube/callback";

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "google-123";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("youtubeAdapter.buildAuthUrl", () => {
  it("requests offline access with consent", () => {
    const url = new URL(youtubeAdapter.buildAuthUrl({ state: "yt.nonce", redirectUri: REDIRECT }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("youtube.upload");
  });
});

describe("youtubeAdapter.getAccountIdentity", () => {
  it("reads the channel id + title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ id: "chan-1", snippet: { title: "My Channel" } }] }),
      }))
    );
    const id = await youtubeAdapter.getAccountIdentity({ accessToken: "tok", scopes: [] });
    expect(id.externalAccountId).toBe("chan-1");
    expect(id.externalAccountName).toBe("My Channel");
  });
});

describe("youtubeAdapter.publish", () => {
  it("requires a video", async () => {
    await expect(
      youtubeAdapter.publish({ accessToken: "t", externalAccountId: "chan-1", text: "x" })
    ).rejects.toThrow(/requires a video/);
  });

  it("uploads via the resumable session and returns the video URL", async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (url === "https://example.com/video.mp4") {
        return {
          ok: true,
          headers: { get: () => "video/mp4" },
          arrayBuffer: async () => new ArrayBuffer(8),
        };
      }
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          headers: { get: (name: string) => (name === "location" ? "https://upload.example/session-1" : null) },
          json: async () => ({}),
        };
      }
      return { ok: true, status: 200, json: async () => ({ id: "video-1" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await youtubeAdapter.publish({
      accessToken: "tok",
      externalAccountId: "chan-1",
      text: "Hello YouTube",
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.externalPostId).toBe("video-1");
    expect(result.externalUrl).toBe("https://www.youtube.com/watch?v=video-1");
  });
});
