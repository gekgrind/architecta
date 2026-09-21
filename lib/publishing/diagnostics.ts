/**
 * Secret-free diagnostics for the OAuth callback. Only the platform, stage and a
 * coarse error classification are logged — never codes, tokens, secrets or URLs.
 */
export type CallbackStage =
  | "provider_error"
  | "missing_code"
  | "state_mismatch"
  | "token_exchange"
  | "identity_lookup"
  | "save_connection";

export function classifyCallbackError(err: unknown): {
  errorName: string;
  errorClass: "config" | "http" | "unknown";
  httpStatus?: number;
} {
  const errorName = err instanceof Error ? err.name : typeof err;
  if (errorName === "PublishConfigError") return { errorName, errorClass: "config" };
  // Adapters embed the upstream status as "(NNN)" in their messages.
  const status = err instanceof Error ? /\((\d{3})\)/.exec(err.message)?.[1] : undefined;
  if (status) return { errorName, errorClass: "http", httpStatus: Number(status) };
  return { errorName, errorClass: "unknown" };
}

export function logCallbackFailure(
  platform: string,
  stage: CallbackStage,
  extra: { err?: unknown; providerError?: string | null } = {}
) {
  const info = extra.err ? classifyCallbackError(extra.err) : {};
  console.error(
    JSON.stringify({
      scope: "oauth_callback",
      platform,
      stage,
      // Provider `error` param values (e.g. "access_denied") are short, fixed codes.
      providerError: extra.providerError?.slice(0, 64),
      ...info,
    })
  );
}
