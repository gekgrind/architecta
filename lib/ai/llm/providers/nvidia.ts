import type { LlmClient, LlmMessage, LlmResult } from "../types";

// NVIDIA Build / NIM exposes an OpenAI-compatible chat completions API.
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Reasoning models can take a while; bound the call so a hung request can't
// leave the caller (and the onboarding UI) waiting indefinitely.
const NVIDIA_TIMEOUT_MS = 90_000;

type NvidiaCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string } | string;
  detail?: string;
  title?: string;
};

function toNvidiaMessages(messages: LlmMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function parseBody(raw: string): NvidiaCompletionResponse {
  try {
    return JSON.parse(raw) as NvidiaCompletionResponse;
  } catch {
    return {};
  }
}

function errorMessage(json: NvidiaCompletionResponse): string {
  if (typeof json.error === "string") return json.error;
  return json.error?.message || json.detail || json.title || "NVIDIA error";
}

// Some reasoning models inline their chain of thought in the content field.
function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function createNvidiaClient(): LlmClient {
  return {
    provider: "nvidia",
    async generate(input) {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) throw new Error("Missing NVIDIA_API_KEY");

      const started = Date.now();

      let res: Response;
      try {
        res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            messages: toNvidiaMessages(input.messages),
            temperature: input.temperature ?? 0.7,
            max_tokens: input.maxTokens ?? 1200,
            stream: false,
          }),
          signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
        });
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          // 408 is non-retryable in the gateway, so a timeout isn't repeated.
          throw Object.assign(new Error("NVIDIA request timed out"), { status: 408 });
        }
        throw err;
      }

      const json = parseBody(await res.text());

      if (!res.ok) {
        const err = Object.assign(new Error(errorMessage(json)), {
          status: res.status,
          raw: json,
        });
        throw err;
      }

      const text = stripReasoning(json.choices?.[0]?.message?.content ?? "");
      const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      const result: LlmResult = {
        provider: "nvidia",
        model: input.model,
        text,
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        requestId: res.headers.get("nvcf-reqid") ?? res.headers.get("x-request-id") ?? undefined,
        latencyMs: Date.now() - started,
      };

      return result;
    },
  };
}
