import type { LlmClient, LlmMessage, LlmResult } from "../types";
import { httpError, postJson, requireApiKey } from "./http";

type OpenAiCompletionResponse = {
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
  error?: {
    message?: string;
  };
};

function toOpenAiMessages(messages: LlmMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function createOpenAiClient(): LlmClient {
  return {
    provider: "openai",
    async generate(input) {
      const apiKey = requireApiKey("openai", "OPENAI_API_KEY");

      const started = Date.now();

      const { res, json: body } = await postJson("openai", "https://api.openai.com/v1/chat/completions", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: input.model,
          messages: toOpenAiMessages(input.messages),
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 1200,
        },
      });

      const json = body as OpenAiCompletionResponse;

      if (!res.ok) {
        throw httpError("openai", res.status, json.error?.message || "OpenAI error", json);
      }

      const text = json.choices?.[0]?.message?.content ?? "";
      const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      const result: LlmResult = {
        provider: "openai",
        model: input.model,
        text,
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        requestId: res.headers.get("x-request-id") ?? undefined,
        latencyMs: Date.now() - started,
      };

      return result;
    },
  };
}
