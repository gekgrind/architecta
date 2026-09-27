import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  serverClient: vi.fn(),
  serviceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: h.serverClient }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: h.serviceClient }));

import { logLlmCall } from "./logger";
import type { LlmGenerateInput, LlmResult } from "../types";

function client(sessionUserId: string | null) {
  const insert = vi.fn(async () => ({ error: null }));
  return {
    insert,
    value: {
      auth: { getUser: vi.fn(async () => ({ data: { user: sessionUserId ? { id: sessionUserId } : null } })) },
      from: vi.fn(() => ({ insert })),
    },
  };
}

const result: LlmResult = {
  provider: "nvidia",
  model: "z-ai/glm-5.3",
  text: "{}",
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
};

function input(overrides: Partial<LlmGenerateInput> = {}): LlmGenerateInput {
  return {
    workspaceId: "job-user",
    userId: "job-user",
    task: "WEBSITE_ANALYSIS",
    messages: [{ role: "user", content: "x" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("logLlmCall", () => {
  it("interactive calls log for the signed-in session user via the session client", async () => {
    const session = client("session-user");
    h.serverClient.mockResolvedValue(session.value);

    await logLlmCall({ input: input({ userId: "someone-else", workspaceId: "someone-else" }), result, routeReason: "r" });

    expect(h.serviceClient).not.toHaveBeenCalled();
    expect(session.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "session-user" }));
  });

  it("interactive calls without a session record nothing (no fallback to input.userId)", async () => {
    const session = client(null);
    h.serverClient.mockResolvedValue(session.value);

    await logLlmCall({ input: input(), result, routeReason: "r" });

    expect(session.insert).not.toHaveBeenCalled();
    expect(h.serviceClient).not.toHaveBeenCalled();
  });

  it("background job calls log for the job's user via the service role, without a session", async () => {
    const service = client(null);
    h.serviceClient.mockResolvedValue(service.value);

    await logLlmCall({ input: input({ background: true }), result, routeReason: "test_provider:nvidia" });

    expect(h.serverClient).not.toHaveBeenCalled();
    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "job-user",
        workspace_id: null,
        task: "WEBSITE_ANALYSIS",
        provider: "nvidia",
        model: "z-ai/glm-5.3",
      })
    );
  });

  it("background calls without a userId record nothing", async () => {
    await logLlmCall({ input: input({ background: true, userId: undefined }), result, routeReason: "r" });

    expect(h.serviceClient).not.toHaveBeenCalled();
    expect(h.serverClient).not.toHaveBeenCalled();
  });
});
