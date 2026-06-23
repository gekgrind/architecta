import type { LlmClient, LlmMessage, LlmResult } from "../types";

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
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

      const started = Date.now();

      // Using fetch keeps dependencies simple.
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          messages: toOpenAiMessages(input.messages),
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 1200,
        }),
      });

      const json = (await res.json()) as OpenAiCompletionResponse;

      if (!res.ok) {
        const err = Object.assign(new Error(json.error?.message || "OpenAI error"), {
          status: res.status,
          raw: json,
        });
        throw err;
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
