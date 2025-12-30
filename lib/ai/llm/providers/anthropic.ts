import type { LlmClient, LlmMessage, LlmResult } from "../types";

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  return {
    provider: "anthropic",
    async generate(input) {
      const started = Date.now();

      const { system, messages } = toAnthropicMessages(input.messages);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          system: system || undefined,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 1200,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const err: any = new Error(json?.error?.message || "Anthropic error");
        (err.status = res.status), (err.raw = json);
        throw err;
      }

      const text = (json.content ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
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
