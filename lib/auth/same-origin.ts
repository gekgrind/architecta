import { getEcosystemAppUrl, getUrlOrigin } from "@/lib/config/ecosystem";

type HeaderReader = { get(name: string): string | null };

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The origins Architecta's own pages are served from, compared whole
 * (scheme, host and port).
 *
 * In production that is the configured `NEXT_PUBLIC_ARCHITECTA_APP_URL`,
 * never a forwarded header: `X-Forwarded-Host` is only trustworthy behind
 * a proxy that overwrites it, which this code cannot know. Locally, the
 * loopback origin the request was made to is accepted too. Without a
 * configured URL the request's own origin is used — a cross-site page
 * cannot choose the Host a victim's browser sends, so that still
 * defeats forgery, but a TLS-terminating proxy that rewrites the scheme
 * would then refuse legitimate sign-outs; configure the URL.
 */
export function getTrustedAppOrigins(request: {
  nextUrl: { origin: string; hostname: string };
}) {
  const configured = getUrlOrigin(getEcosystemAppUrl("architecta"));
  const origins = new Set<string>();

  if (configured) {
    origins.add(configured);
  } else {
    origins.add(request.nextUrl.origin);
  }

  if (
    process.env.NODE_ENV !== "production" &&
    LOOPBACK_HOSTNAMES.has(request.nextUrl.hostname)
  ) {
    origins.add(request.nextUrl.origin);
  }

  return origins;
}

/** A serialized origin, or null unless the value is exactly one. */
function parseOrigin(value: string) {
  try {
    const url = new URL(value);

    /* scheme://host[:port], nothing more; rules out the opaque `null`. */
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.origin !== value.toLowerCase()
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Whether a state-changing request provably comes from one of
 * `trustedOrigins`, judged only from headers page script cannot set.
 *
 * - `Sec-Fetch-Site`, when present, must be `same-origin`.
 * - `Origin`, when present, must equal a trusted origin exactly.
 * - At least one of them must be present. Every current browser sends
 *   `Origin` on a POST, so a request with neither proves nothing about
 *   where it came from and is refused.
 *
 * Contradictory headers fail one of the checks.
 */
export function isSameOriginRequest(
  request: { headers: HeaderReader },
  trustedOrigins: ReadonlySet<string>
) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");

  if (site !== null && site.trim().toLowerCase() !== "same-origin") {
    return false;
  }

  if (origin === null) {
    return site !== null;
  }

  const parsed = parseOrigin(origin.trim());

  return parsed !== null && trustedOrigins.has(parsed);
}
