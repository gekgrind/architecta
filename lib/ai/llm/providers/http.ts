import { categoryForStatus, LlmProviderError } from "../errors";
import type { LlmProvider } from "../types";

/**
 * Upper bound on a single Anthropic/OpenAI text request. Matches NVIDIA's
 * bound so a stalled provider can't hold a request open indefinitely.
 */
export const PROVIDER_TIMEOUT_MS = 90_000;

export function requireApiKey(provider: LlmProvider, envName: string): string {
  const key = process.env[envName];
  if (!key) {
    throw new LlmProviderError(`Missing ${envName}`, { category: "configuration", provider });
  }
  return key;
}

/** POST JSON with a bounded timeout; transport failures become typed errors. */
export async function postJson(
  provider: LlmProvider,
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<{ res: Response; json: unknown }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: init.headers,
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new LlmProviderError(`${provider} request timed out`, {
        category: "timeout",
        provider,
        status: 408,
      });
    }
    throw new LlmProviderError(`${provider} request failed to connect`, {
      category: "network",
      provider,
    });
  }

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { res, json };
}

export function httpError(
  provider: LlmProvider,
  status: number,
  message: string,
  raw: unknown
): LlmProviderError {
  return new LlmProviderError(message, {
    category: categoryForStatus(status, raw),
    provider,
    status,
    raw,
  });
}
