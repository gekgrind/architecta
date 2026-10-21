import { getEcosystemAppUrl, getUrlOrigin } from "@/lib/config/ecosystem";

type HeaderReader = { get(name: string): string | null };

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Where Architecta is served when nothing configures it otherwise. */
export const CANONICAL_APP_ORIGIN = "https://architecta.entrepreneuria.io";

type AppRequest = { nextUrl: { origin: string; hostname: string } };

/**
 * The origin Architecta's own pages are served from, for redirects and
 * the sign-out origin check alike.
 *
 * The configured `NEXT_PUBLIC_ARCHITECTA_APP_URL` when there is one,
 * never a forwarded header: `X-Forwarded-Host` is only trustworthy
 * behind a proxy that overwrites it, which this code cannot know. Not
 * the request's own origin in production either: under `next start`
 * behind nginx a route handler's `request.url` is the bind address
 * (`http://localhost:3000`), so a redirect built on it sends visitors to
 * localhost, and a POST from the real site would be refused. Without a
 * configured URL, production falls back to the canonical origin; local
 * development uses the request's origin.
 */
export function getPublicAppOrigin(request: AppRequest) {
  const configured = getUrlOrigin(getEcosystemAppUrl("architecta"));

  if (configured) return configured;

  return process.env.NODE_ENV === "production"
    ? CANONICAL_APP_ORIGIN
    : request.nextUrl.origin;
}

/**
 * The origins Architecta's own pages are served from, compared whole
 * (scheme, host and port): `getPublicAppOrigin`, plus locally the
 * loopback origin the request was made to.
 */
export function getTrustedAppOrigins(request: AppRequest) {
  const origins = new Set<string>([getPublicAppOrigin(request)]);

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
