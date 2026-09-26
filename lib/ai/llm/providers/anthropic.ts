import type { LlmClient, LlmMessage, LlmResult } from "../types";
import { httpError, postJson, requireApiKey } from "./http";

type AnthropicMessageResponse = {
  content?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: string;
        text?: string;
      }
  >;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

function toAnthropicMessages(messages: LlmMessage[]) {
  // Anthropic supports "system" separately; we’ll merge system into a single system string.
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const system = systemParts.join("\n\n");

  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  return { system, messages: rest };
}

export function createAnthropicClient(): LlmClient {
  return {
    provider: "anthropic",
    async generate(input) {
      const apiKey = requireApiKey("anthropic", "ANTHROPIC_API_KEY");

      const started = Date.now();

      const { system, messages } = toAnthropicMessages(input.messages);

      const { res, json: body } = await postJson("anthropic", "https://api.anthropic.com/v1/messages", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: {
          model: input.model,
          system: system || undefined,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 1200,
        },
      });

      const json = body as AnthropicMessageResponse;

      if (!res.ok) {
        throw httpError("anthropic", res.status, json.error?.message || "Anthropic error", json);
      }

      const text = (json.content ?? [])
        .filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("\n");

      const usage = json.usage ?? { input_tokens: 0, output_tokens: 0 };

      const result: LlmResult = {
        provider: "anthropic",
        model: input.model,
        text,
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        },
        requestId: res.headers.get("request-id") ?? undefined,
        latencyMs: Date.now() - started,
      };

      return result;
    },
  };
}
