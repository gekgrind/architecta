import "server-only";

import { DestinationConfigError } from "./types";

/**
 * Every credential-based destination takes a URL from the user — a WordPress
 * site, a Ghost site, a custom webhook endpoint — and then fetches it from the
 * server with their credential attached. That makes an unguarded fetch an SSRF
 * primitive, so the same two rules apply to all three: https only, and no
 * loopback / link-local / RFC1918 hosts.
 */

const PRIVATE_HOST =
  /^(localhost$|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0$)/i;

export function normalizePublicHttpsUrl(
  raw: string,
  messages: { invalid: string; insecure: string; private: string }
): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DestinationConfigError(messages.invalid);
  }
  if (url.protocol !== "https:") {
    throw new DestinationConfigError(messages.insecure);
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    throw new DestinationConfigError(messages.private);
  }
  return url;
}
