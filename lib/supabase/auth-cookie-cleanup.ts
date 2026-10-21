import type { NextResponse } from "next/server";
import { stringFromBase64URL } from "@supabase/ssr";

import {
  ENTREPRENEURIA_AUTH_COOKIE_NAME,
  getSharedSupabaseCookieOptions,
  isEntrepreneuriaHostname,
} from "@/lib/supabase/cookies";

/*
 * Retiring auth cookies written under the wrong scope, or left behind in
 * a shape the session reader can never assemble. This mirrors
 * entrepreneuria's `lib/supabase/auth-cookie-cleanup.ts`; it has to run
 * here as well because a cookie that is host-only to
 * architecta.entrepreneuria.io is never sent to entrepreneuria.io, so
 * only Architecta can ever expire it.
 *
 * A cookie is identified by name + Domain + Path, and a deletion only
 * removes the cookie with exactly that scope: a host-only expiry never
 * touches the `.entrepreneuria.io` copy and vice versa. Before the shared
 * scope was enforced Architecta planted host-only copies of the shared
 * session next to the canonical `.entrepreneuria.io` ones, so both
 * scopes have to be addressed explicitly here.
 *
 * These expiries are appended as raw Set-Cookie headers because Next's
 * `response.cookies` holds one entry per name — the second scope of the
 * same name would silently replace the first. For the same reason they
 * must be appended after the response's last `response.cookies.set`,
 * which rewrites every Set-Cookie header from that name-keyed map.
 */

type HeaderReader = { get(name: string): string | null };

type CookieScope = "host-only" | "shared-domain";

export type AuthCookieInventory = {
  /** Hostname that decides the canonical scope, as the writers read it. */
  cookieHostname: string | null;
  /** Distinct shared-session cookie names the browser sent. */
  session: string[];
  /** Distinct legacy Supabase auth cookie names the browser sent. */
  legacy: string[];
  /** A shared-session name arrived more than once: two scopes coexist. */
  duplicated: boolean;
  /**
   * Every duplicated name arrived with the same value each time: the two
   * scopes hold byte-identical copies, so dropping one loses nothing.
   */
  identicalDuplicates: boolean;
  /**
   * Shared-session names that can never be part of a readable session
   * (see `findUnreadableSessionCookies`). Always empty when duplicates
   * differ: the Cookie header does not say which scope one came from.
   */
  unreadable: string[];
  /**
   * Every distinct readable session the sent cookies can assemble, one
   * per scope family (see `assembleSessionCandidates`).
   */
  candidates: SessionCandidate[];
  /** Assembly gave up before trying every combination. */
  candidatesTruncated: boolean;
  /**
   * More than one session generation may be present: a name arrived
   * twice with different values, or two readable families coexist under
   * different names (a bare cookie beside chunks). A name-keyed reader
   * then sees only one of them, so nothing it derives may touch the
   * other — see `auth-session-resolution`. Byte-identical copies in two
   * scopes are one session, not a conflict.
   */
  conflict: boolean;
};

/**
 * One readable session, as the cookies of a single family hold it.
 *
 * Everything but the cookies themselves is read from an unverified
 * cookie: any host on the shared domain can plant one, and the access
 * token is decoded without checking its signature. These fields are
 * hints for ordering work, never evidence for deleting anything — only
 * an Auth API answer about a candidate's own tokens is (see
 * `auth-session-resolution`).
 */
export type SessionCandidate = {
  /** One value per cookie name, exactly as a reader would assemble it. */
  cookies: { name: string; value: string }[];
  accessToken: string;
  refreshToken: string;
  /** The stored `expires_at`, in Unix seconds. Unverified. */
  expiresAt: number;
  /** The access token's `exp` claim, in Unix seconds. Unverified. */
  tokenExpiresAt: number | null;
  /**
   * The access token's `session_id` claim: one per sign-in, kept across
   * every refresh of it. Null when the token does not carry one.
   * Unverified until the Auth API accepts the token.
   */
  sessionId: string | null;
  /** The token's `sub`, else the stored user's id. Unverified. */
  userId: string | null;
};

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user?: { id?: unknown } | null;
};

const KEY = ENTREPRENEURIA_AUTH_COOKIE_NAME;

const CHUNK_SUFFIX = /^\.(0|[1-9][0-9]*)$/;

/* RFC 6265 cookie-name token; anything else is never echoed back. */
const COOKIE_NAME_TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

const BASE64_PREFIX = "base64-";

/*
 * The anti-cache headers @supabase/ssr 0.10.3 passes as the second
 * argument of `setAll` whenever it writes auth cookies. Responses that
 * change auth cookies without going through Supabase (the expiries
 * below, logout) carry the same ones, so no shared cache can store a
 * Set-Cookie holding someone's session.
 */
export const AUTH_NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export function applyAuthResponseHeaders(
  response: NextResponse,
  headers: Record<string, string> = AUTH_NO_STORE_HEADERS
) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

/** `entrepreneuria-auth-token` and its `.0`, `.1`, … chunks. */
export function isSharedSessionCookieName(name: string) {
  return (
    name === KEY ||
    (name.startsWith(KEY) && CHUNK_SUFFIX.test(name.slice(KEY.length)))
  );
}

/** Supabase's default cookie names from before the shared storage key. */
export function isLegacySupabaseAuthCookieName(name: string) {
  return (
    name === "sb-access-token" ||
    name === "sb-refresh-token" ||
    name === "supabase-auth-token" ||
    (name.startsWith("sb-") && name.includes("auth-token"))
  );
}

/*
 * Whether a stored value is a session auth-js would accept, decoded
 * exactly as @supabase/ssr 0.10.3 does: a `base64-` value that fails
 * base64url or JSON decoding is reported as absent (and so never
 * removed by Supabase itself); anything else is JSON-parsed by auth-js
 * and must carry the fields its `_isValidSession` checks.
 */
function parseStoredSession(value: string): StoredSession | null {
  let decoded = value;

  if (value.startsWith(BASE64_PREFIX)) {
    try {
      decoded = stringFromBase64URL(value.slice(BASE64_PREFIX.length));
    } catch {
      return null;
    }
  }

  try {
    const session: unknown = JSON.parse(decoded);

    return typeof session === "object" &&
      session !== null &&
      "access_token" in session &&
      "refresh_token" in session &&
      "expires_at" in session
      ? (session as StoredSession)
      : null;
  } catch {
    return null;
  }
}

function isReadableSession(value: string) {
  return parseStoredSession(value) !== null;
}

/** The token's payload, decoded without verifying anything. */
export function claimsOf(accessToken: string): Record<string, unknown> {
  try {
    const claims: unknown = JSON.parse(
      stringFromBase64URL(accessToken.split(".")[1] ?? "")
    );

    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/* Bounds the combinations tried below; a browser holds at most a few
   scopes of one name, so real requests stay far under it. */
const MAX_CANDIDATE_ASSEMBLIES = 64;

/**
 * Every distinct readable session the sent cookies can hold.
 *
 * The Cookie header carries each scope's copy of a name, but not which
 * scope it came from, so a family cannot be read off by scope. Instead
 * every value of the bare cookie, and every chain of `.0`, `.1`, … values
 * up to the first that decodes, is tried as its own session — the
 * reader's own rules, applied per family instead of per collapsed name.
 * One copy of the same session in two scopes is one candidate.
 *
 * A chain stitched from two families can still decode when the chunk
 * boundary falls inside content both share: the head chunk's tokens over
 * the other family's cached user. Such a chain is rejected outright when
 * that user is not the token's subject, and otherwise yields to the chain
 * drawn from one header position — a family's chunks are written
 * together, so they sit at the same position among their names'
 * occurrences.
 *
 * `occurrences` holds every decoded value per name, in header order.
 */
export function assembleSessionCandidates(occurrences: Map<string, string[]>) {
  const found = new Map<
    string,
    { candidate: SessionCandidate; aligned: boolean }
  >();
  let budget = MAX_CANDIDATE_ASSEMBLIES;
  let truncated = false;

  function positions(name: string, value: string) {
    return (occurrences.get(name) ?? []).flatMap((occurrence, index) =>
      occurrence === value ? [index] : []
    );
  }

  function isAligned(cookies: SessionCandidate["cookies"]) {
    const [first, ...rest] = cookies.map(({ name, value }) =>
      positions(name, value)
    );

    return (first ?? []).some((index) =>
      rest.every((indexes) => indexes.includes(index))
    );
  }

  function accept(cookies: SessionCandidate["cookies"]) {
    const session = parseStoredSession(
      cookies.map(({ value }) => value).join("")
    );

    if (
      !session ||
      typeof session.access_token !== "string" ||
      typeof session.refresh_token !== "string"
    ) {
      return false;
    }

    const claims = claimsOf(session.access_token);
    const userId = session.user?.id;

    if (
      typeof userId === "string" &&
      typeof claims.sub === "string" &&
      userId !== claims.sub
    ) {
      return false;
    }

    const key = `${session.access_token}|${session.refresh_token}`;
    const aligned = isAligned(cookies);
    const existing = found.get(key);

    if (!existing || (aligned && !existing.aligned)) {
      found.set(key, {
        aligned,
        candidate: {
          cookies,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: Number(session.expires_at) || 0,
          tokenExpiresAt:
            typeof claims.exp === "number" && Number.isFinite(claims.exp)
              ? claims.exp
              : null,
          sessionId:
            typeof claims.session_id === "string" ? claims.session_id : null,
          userId:
            typeof claims.sub === "string"
              ? claims.sub
              : typeof userId === "string"
                ? userId
                : null,
        },
      });
    }

    return true;
  }

  for (const value of new Set(occurrences.get(KEY) ?? [])) {
    if (budget <= 0) {
      truncated = true;
      break;
    }
    budget -= 1;
    accept([{ name: KEY, value }]);
  }

  function extend(index: number, cookies: SessionCandidate["cookies"]) {
    const name = `${KEY}.${index}`;

    for (const value of new Set(occurrences.get(name) ?? [])) {
      if (budget <= 0) {
        truncated = true;
        return;
      }
      budget -= 1;

      const chain = [...cookies, { name, value }];

      if (!accept(chain)) {
        extend(index + 1, chain);
      }
    }
  }

  extend(0, []);

  return {
    candidates: [...found.values()].map(({ candidate }) => candidate),
    truncated,
  };
}

/**
 * The shared-session cookies that cannot contribute to a readable
 * session, judged only from the cookies themselves — never from whether
 * Supabase could validate the session, so an Auth API or network
 * failure can never cause a structurally sound session to be deleted.
 *
 * Mirrors @supabase/ssr's reader: the bare cookie wins when it has a
 * value, otherwise chunks are joined from `.0` up to the first gap.
 * The live cookies are the bare one if it decodes to a session, or else
 * the contiguous `.0…` run that does — the shortest one, so a stale `.2`
 * trailing a sound `.0`/`.1` is dropped instead of the whole session.
 * Every other name in the family (a corrupt or empty bare cookie, chunks
 * past a gap, orphans with no `.0`, chunks shadowed by a readable bare
 * cookie, a run that never decodes) is unreadable.
 *
 * `values` must hold one value per name, as the reader sees them.
 */
export function findUnreadableSessionCookies(values: Map<string, string>) {
  const bare = values.get(KEY);
  let live: string[] = [];

  if (bare && isReadableSession(bare)) {
    live = [KEY];
  } else {
    let joined = "";

    for (let index = 0; ; index += 1) {
      const chunk = values.get(`${KEY}.${index}`);

      if (!chunk) {
        break;
      }

      joined += chunk;

      if (isReadableSession(joined)) {
        live = Array.from(
          { length: index + 1 },
          (_, chunkIndex) => `${KEY}.${chunkIndex}`
        );
        break;
      }
    }
  }

  return [...values.keys()].filter((name) => !live.includes(name));
}

/*
 * Read from the raw Cookie header, not `request.cookies`: that map keeps
 * one value per name, which hides exactly the duplicates this is for.
 * Take it before any Supabase client runs.
 */
export function readAuthCookieInventory(request: {
  headers: HeaderReader;
}): AuthCookieInventory {
  const pairs = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => {
      const separator = pair.indexOf("=");

      return separator === -1
        ? { name: pair.trim(), value: "" }
        : {
            name: pair.slice(0, separator).trim(),
            value: pair.slice(separator + 1).trim(),
          };
    })
    .filter(({ name }) => Boolean(name));
  const sessionPairs = pairs.filter(({ name }) =>
    isSharedSessionCookieName(name)
  );
  const session = [...new Set(sessionPairs.map(({ name }) => name))];
  const duplicated = session.length !== sessionPairs.length;
  const identicalDuplicates = session.every(
    (name) =>
      new Set(
        sessionPairs
          .filter((pair) => pair.name === name)
          .map(({ value }) => value)
      ).size === 1
  );

  /* One value per name, decoded the way Next's request.cookies does
     before Supabase reads it. A value that fails to decode is dropped
     there, so here it reads as empty — never part of a session. */
  const values = new Map<string, string>(session.map((name) => [name, ""]));
  /* Every value per name, for telling the families apart. Empty and
     undecodable values are never part of a session. */
  const occurrences = new Map<string, string[]>();

  for (const { name, value } of sessionPairs) {
    try {
      const decoded = decodeURIComponent(value);
      values.set(name, decoded);

      if (decoded) {
        occurrences.set(name, [...(occurrences.get(name) ?? []), decoded]);
      }
    } catch {
      // Next skips the pair; an earlier decodable value, if any, stands.
    }
  }

  const { candidates, truncated } = assembleSessionCandidates(occurrences);

  return {
    /* The same Host read every Architecta writer takes its scope from. */
    cookieHostname: request.headers.get("host"),
    session,
    legacy: [
      ...new Set(
        pairs.map(({ name }) => name).filter(isLegacySupabaseAuthCookieName)
      ),
    ],
    duplicated,
    identicalDuplicates,
    unreadable:
      duplicated && !identicalDuplicates
        ? []
        : findUnreadableSessionCookies(values),
    candidates,
    candidatesTruncated: truncated,
    conflict: (duplicated && !identicalDuplicates) || candidates.length > 1,
  };
}

function expiredSetCookie(
  name: string,
  domain: string | undefined,
  secure: boolean
) {
  return [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    ...(domain ? [`Domain=${domain}`] : []),
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
  ].join("; ");
}

function expireAuthCookies(
  response: NextResponse,
  names: Iterable<string>,
  scopes: CookieScope[],
  cookieHostname: string | null
) {
  const { domain: sharedDomain, secure = false } =
    getSharedSupabaseCookieOptions(cookieHostname);
  /* The response's own Set-Cookie for a name + scope always stands, so
     a freshly written session is never expired by its own response. */
  const addressed = new Set(
    response.cookies
      .getAll()
      .map((cookie) => `${cookie.name}|${cookie.domain ?? ""}`)
  );
  let expired = false;

  for (const name of new Set(names)) {
    if (!COOKIE_NAME_TOKEN.test(name)) {
      continue;
    }

    for (const scope of scopes) {
      const domain = scope === "shared-domain" ? sharedDomain : undefined;

      if (
        (scope === "shared-domain" && !domain) ||
        addressed.has(`${name}|${domain ?? ""}`)
      ) {
        continue;
      }

      response.headers.append(
        "set-cookie",
        expiredSetCookie(name, domain, secure)
      );
      expired = true;
    }
  }

  if (expired) {
    applyAuthResponseHeaders(response);
  }
}

/**
 * Moves a browser onto the single canonical `.entrepreneuria.io` scope
 * and clears session cookies that can never be read back.
 *
 * Host-only session copies are retired whenever the family is known to
 * be in flux: this response writes the session, or the browser sent the
 * same chunk name twice (both scopes present). The canonical copies are
 * never touched on those grounds, so a valid shared session is not lost.
 * Legacy `sb-*` host-only cookies are retired whenever present; on the
 * Architecta host only Architecta can have written them.
 *
 * Structurally unreadable session cookies are retired in every scope
 * this host can hold them in, canonical included — but only when the
 * cookies themselves prove it (`inventory.unreadable`). A session that
 * Supabase merely failed to validate (Auth API down, network error,
 * revoked token) is left to Supabase.
 *
 * Off the shared domain (local development) the canonical scope is
 * host-only itself: there is no second scope to retire, and localhost
 * `sb-*` cookies may belong to other local projects.
 *
 * Only for a request without a conflict (`inventory.conflict`): with two
 * generations present, which copy the response's own session writes came
 * from is unknown, so `settleSessionConflict` decides instead.
 */
export function retireStaleAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse
) {
  const sharedDomain = isEntrepreneuriaHostname(inventory.cookieHostname);

  if (sharedDomain) {
    const written = response.cookies
      .getAll()
      .map((cookie) => cookie.name)
      .filter(isSharedSessionCookieName);
    const inFlux = written.length > 0 || inventory.duplicated;

    expireAuthCookies(
      response,
      [
        ...(inFlux ? [...inventory.session, ...written] : []),
        ...inventory.legacy,
      ],
      ["host-only"],
      inventory.cookieHostname
    );
  }

  expireAuthCookies(
    response,
    inventory.unreadable,
    sharedDomain ? ["shared-domain", "host-only"] : ["host-only"],
    inventory.cookieHostname
  );
}

export type SessionResolutionStatus =
  | "live"
  | "pinned"
  | "revoked"
  | "ambiguous"
  | "unresolved"
  | "unverifiable";

/**
 * Settles a conflict (`inventory.conflict`) once each candidate has been
 * judged on its own — in place of `retireStaleAuthCookies`, after the
 * response's last `response.cookies.set`.
 *
 * - `live`: the response already writes the surviving session, proven
 *   by a refresh, in the canonical scope, and every other candidate was
 *   refused by the Auth API, so every other copy of every family name,
 *   in every scope, is retired. The canonical writes stand (see
 *   `expireAuthCookies`).
 * - `revoked`: every readable family was rejected by the Auth API, and
 *   the rest never decoded; all of them are retired.
 * - anything else: some copy was not ruled out by the Auth API (an
 *   unproven pairing, a second sign-in or identity, an outage, too many
 *   copies), so no family cookie is touched in any scope.
 *
 * Legacy `sb-*` host-only cookies are retired as `retireStaleAuthCookies`
 * does.
 */
export function settleSessionConflict(
  inventory: AuthCookieInventory,
  status: SessionResolutionStatus,
  response: NextResponse
) {
  const sharedDomain = isEntrepreneuriaHostname(inventory.cookieHostname);

  if (status === "live" || status === "revoked") {
    const written = response.cookies
      .getAll()
      .map((cookie) => cookie.name)
      .filter(isSharedSessionCookieName);

    expireAuthCookies(
      response,
      [...inventory.session, ...written],
      sharedDomain ? ["shared-domain", "host-only"] : ["host-only"],
      inventory.cookieHostname
    );
    applyAuthResponseHeaders(response);
  }

  if (sharedDomain) {
    expireAuthCookies(
      response,
      inventory.legacy,
      ["host-only"],
      inventory.cookieHostname
    );
  }
}

/**
 * Logout: expires every shared-session and legacy auth cookie the
 * browser sent, in both the `.entrepreneuria.io` and host-only scopes.
 */
export function expireAllAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse
) {
  expireAuthCookies(
    response,
    [...inventory.session, ...inventory.legacy],
    isEntrepreneuriaHostname(inventory.cookieHostname)
      ? ["shared-domain", "host-only"]
      : ["host-only"],
    inventory.cookieHostname
  );
  applyAuthResponseHeaders(response);
}
