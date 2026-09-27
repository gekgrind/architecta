import type { LlmProvider } from "./types";

/**
 * Provider failure categories. Retry and fallback decisions depend on the
 * category, so a missing key or a billing problem can never be mistaken for a
 * transient outage and cascade into another paid provider.
 */
export type LlmErrorCategory =
  | "configuration" // missing key / disabled provider / bad server config
  | "authentication" // 401/403
  | "quota" // billing or quota exhausted
  | "rate_limit" // provider 429 (not quota)
  | "timeout"
  | "network" // connection failed before a response
  | "invalid_request" // other 4xx
  | "provider" // 5xx
  | "unknown";

export class LlmProviderError extends Error {
  readonly category: LlmErrorCategory;
  readonly provider?: LlmProvider;
  readonly status?: number;
  readonly raw?: unknown;

  constructor(
    message: string,
    opts: { category: LlmErrorCategory; provider?: LlmProvider; status?: number; raw?: unknown }
  ) {
    super(message);
    this.name = "LlmProviderError";
    this.category = opts.category;
    this.provider = opts.provider;
    this.status = opts.status;
    this.raw = opts.raw;
  }
}

function getStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined;
  const n = Number((err as { status?: unknown }).status);
  return Number.isFinite(n) ? n : undefined;
}

function mentionsQuota(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  const text = (typeof raw === "string" ? raw : JSON.stringify(raw)).toLowerCase();
  return /insufficient_quota|quota|billing|credit balance/.test(text);
}

export function categoryForStatus(status: number, raw?: unknown): LlmErrorCategory {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "quota";
  if (status === 408) return "timeout";
  if (status === 429) return mentionsQuota(raw) ? "quota" : "rate_limit";
  if (status >= 500 && status <= 599) return "provider";
  if (status >= 400 && status <= 499) return mentionsQuota(raw) ? "quota" : "invalid_request";
  return "unknown";
}

export function classifyLlmError(err: unknown): LlmErrorCategory {
  if (err instanceof LlmProviderError) return err.category;

  const status = getStatus(err);
  if (status !== undefined) {
    const raw =
      typeof err === "object" && err !== null && "raw" in err
        ? (err as { raw?: unknown }).raw
        : undefined;
    return categoryForStatus(status, raw);
  }

  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    if (/^Missing [A-Z_]+_API_KEY$/.test(err.message)) return "configuration";
    // fetch() rejects with a TypeError when the connection itself fails.
    if (err instanceof TypeError) return "network";
  }
  return "unknown";
}

/** Same provider, same model, one more time. Only for genuinely transient failures. */
export function isRetryableCategory(category: LlmErrorCategory): boolean {
  return category === "rate_limit" || category === "provider" || category === "network";
}

/**
 * Move on to the next provider in the (bounded) chain. Only outages qualify —
 * never configuration, auth, quota, provider rate limits or bad requests.
 */
export function allowsFallback(category: LlmErrorCategory): boolean {
  return category === "timeout" || category === "provider" || category === "network";
}

const SAFE_MESSAGES: Record<LlmErrorCategory, string> = {
  configuration: "AI generation is not available right now.",
  authentication: "AI generation is temporarily unavailable. Please try again later.",
  quota: "AI generation is temporarily unavailable. Please try again later.",
  rate_limit: "The AI service is busy right now. Please try again in a minute.",
  timeout: "The AI request timed out. Please try again.",
  network: "AI generation failed. Please try again.",
  invalid_request: "The AI request could not be processed.",
  provider: "AI generation failed. Please try again.",
  unknown: "AI generation failed. Please try again.",
};

/**
 * What the gateway throws once the bounded chain is exhausted. The message is
 * user-safe (no provider text, no key names); `status` and `cause` keep the
 * underlying failure for server-side logs.
 */
export class AiGatewayError extends Error {
  readonly category: LlmErrorCategory;
  readonly status?: number;
  readonly provider?: LlmProvider;

  constructor(
    category: LlmErrorCategory,
    opts: { status?: number; provider?: LlmProvider; cause?: unknown } = {}
  ) {
    super(SAFE_MESSAGES[category], { cause: opts.cause });
    this.name = "AiGatewayError";
    this.category = category;
    this.status = opts.status;
    this.provider = opts.provider;
  }
}

export function errorStatus(err: unknown): number | undefined {
  return getStatus(err);
}
