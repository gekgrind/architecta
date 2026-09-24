import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNvidiaClient, NVIDIA_BASE_URL } from "./nvidia";
import { buildRoutePlan } from "../router";
import { TASK_ROUTES } from "../tasks";

const FAKE_KEY = "nvapi-test-key-not-real-0000";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseInput = {
  workspaceId: "ws-1",
  userId: "user-1",
  task: "WEBSITE_ANALYSIS" as const,
  model: "z-ai/glm-5.3",
  messages: [
    { role: "system" as const, content: "sys" },
    { role: "user" as const, content: "hello" },
  ],
  maxTokens: 2000,
  temperature: 0.2,
};

describe("createNvidiaClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NVIDIA_API_KEY", FAKE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls NVIDIA's OpenAI-compatible chat completions endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );

    const result = await createNvidiaClient().generate(baseInput);

    expect(NVIDIA_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);

    const body = JSON.parse(init.body);
    expect(body.model).toBe("z-ai/glm-5.3");
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(2000);
    expect(body.messages).toEqual(baseInput.messages);

    expect(result).toMatchObject({
      provider: "nvidia",
      model: "z-ai/glm-5.3",
      text: "ok",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });

  it("strips inline <think> reasoning from the content", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "<think>let me reason {\"x\":1}</think>\n{\"a\":1}" } }],
      })
    );

    const result = await createNvidiaClient().generate(baseInput);
    expect(result.text).toBe('{"a":1}');
  });

  it("throws with the HTTP status on provider errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, title: "Unauthorized", detail: "Authentication failed" }, 401)
    );

    await expect(createNvidiaClient().generate(baseInput)).rejects.toMatchObject({
      message: "Authentication failed",
      status: 401,
    });
  });

  it("handles non-JSON error bodies", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(createNvidiaClient().generate(baseInput)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("fails fast without calling the network when NVIDIA_API_KEY is missing", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");

    await expect(createNvidiaClient().generate(baseInput)).rejects.toThrow(
      "Missing NVIDIA_API_KEY"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("WEBSITE_ANALYSIS routing", () => {
  it("defaults every tier to NVIDIA z-ai/glm-5.3", () => {
    for (const tier of ["draft", "standard", "premium"] as const) {
      expect(TASK_ROUTES.WEBSITE_ANALYSIS[tier]).toEqual({
        provider: "nvidia",
        model: "z-ai/glm-5.3",
      });
    }
  });

  it("ignores pinned provider preferences and has no fallback", () => {
    for (const preference of ["auto", "openai", "anthropic"] as const) {
      const plan = buildRoutePlan({
        task: "WEBSITE_ANALYSIS",
        tier: "draft",
        workspacePreference: preference,
      });
      expect(plan.primary).toEqual({ provider: "nvidia", model: "z-ai/glm-5.3" });
      expect(plan.fallbacks).toEqual([]);
    }
  });

  it("leaves other tasks on their existing routes", () => {
    const plan = buildRoutePlan({ task: "ONBOARDING_SUGGESTION", tier: "draft" });
    expect(plan.primary).toEqual({ provider: "openai", model: "gpt-4o-mini" });
  });
});
