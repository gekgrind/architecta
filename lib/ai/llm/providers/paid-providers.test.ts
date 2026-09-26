import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyLlmError, LlmProviderError } from "../errors";
import { createAnthropicClient } from "./anthropic";
import { PROVIDER_TIMEOUT_MS } from "./http";
import { generateImage, ImageGenerationUnavailableError } from "./openai-images";
import { generateVideo, VideoNotAvailableError } from "./openai-video";
import { createOpenAiClient } from "./openai";

/** Paid-provider clients with the network mocked. No live requests. */

const fetchMock = vi.fn();

const baseInput = {
  userId: "user-1",
  workspaceId: "user-1",
  task: "POST_GENERATION" as const,
  model: "claude-sonnet-4-6",
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 300,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AI_TEST_PROVIDER", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each([
  ["anthropic", createAnthropicClient, "ANTHROPIC_API_KEY"],
  ["openai", createOpenAiClient, "OPENAI_API_KEY"],
] as const)("%s text client", (provider, create, envName) => {
  it("fails with a configuration error — without any network call — when the key is missing", async () => {
    vi.stubEnv(envName, "");

    const err = await create().generate(baseInput).catch((e) => e);

    expect(err).toBeInstanceOf(LlmProviderError);
    expect(classifyLlmError(err)).toBe("configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a bounded timeout signal and the capped max_tokens", async () => {
    fetchMock.mockResolvedValue(
      json(
        provider === "anthropic"
          ? { content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } }
          : { choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }
      )
    );
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    const result = await create().generate(baseInput);

    expect(result.text).toBe("ok");
    expect(timeoutSpy).toHaveBeenCalledWith(PROVIDER_TIMEOUT_MS);
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body).max_tokens).toBe(300);
    timeoutSpy.mockRestore();
  });

  it("maps a stalled request to a timeout error (status 408)", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));

    const err = await create().generate(baseInput).catch((e) => e);

    expect(classifyLlmError(err)).toBe("timeout");
    expect(err.status).toBe(408);
  });

  it("maps a connection failure to a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await create().generate(baseInput).catch((e) => e);
    expect(classifyLlmError(err)).toBe("network");
  });

  it("classifies HTTP 401 as authentication", async () => {
    fetchMock.mockResolvedValue(json({ error: { message: "bad key" } }, 401));
    const err = await create().generate(baseInput).catch((e) => e);
    expect(classifyLlmError(err)).toBe("authentication");
    expect(err.status).toBe(401);
  });

  it("classifies a quota 429 as quota, not a retryable rate limit", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: "You exceeded your current quota", type: "insufficient_quota" } }, 429)
    );
    const err = await create().generate(baseInput).catch((e) => e);
    expect(classifyLlmError(err)).toBe("quota");
  });

  it("survives a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    const err = await create().generate(baseInput).catch((e) => e);
    expect(classifyLlmError(err)).toBe("provider");
  });
});

describe("image generation in AI test mode", () => {
  it("is unavailable and never calls OpenAI", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "nvidia");

    await expect(generateImage({ prompt: "a cat" })).rejects.toBeInstanceOf(
      ImageGenerationUnavailableError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted image model before any network call", async () => {
    await expect(generateImage({ prompt: "a cat", model: "gpt-image-99" })).rejects.toThrow(
      "Unsupported image model"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("video generation in AI test mode", () => {
  it("is unavailable (storyboard path) and never calls Sora", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "nvidia");

    await expect(generateVideo({ prompt: "a launch teaser" })).rejects.toBeInstanceOf(
      VideoNotAvailableError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is also off when AI_TEST_PROVIDER is misconfigured (fails closed)", async () => {
    vi.stubEnv("AI_TEST_PROVIDER", "something-else");
    await expect(generateVideo({ prompt: "x" })).rejects.toBeInstanceOf(VideoNotAvailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted video model before any network call", async () => {
    await expect(generateVideo({ prompt: "x", model: "sora-9-ultra" })).rejects.toBeInstanceOf(
      VideoNotAvailableError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
