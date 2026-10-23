import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";
import {
  DEFAULT_COOKIE_OPTIONS,
  createChunks,
  stringToBase64URL,
} from "@supabase/ssr";

import type {
  AuthCookieInventory,
  SessionCandidate,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  AUTH_NO_STORE_HEADERS,
  claimsOf,
} from "@/lib/supabase/auth-cookie-cleanup";

/*
 * Resolving which session survives when the browser holds more than one
 * (`inventory.conflict`), and revoking them all at sign-out.
 *
 * Next's `request.cookies` keeps one value per name, so a Supabase client
 * reading it sees whichever family the browser happened to send last.
 * Here each candidate is instead judged on its own, by direct Auth API
 * calls about its own tokens.
 *
 * Evidence rules:
 *
 * - What a cookie says about itself is not evidence. Any host on the
 *   shared domain can plant one, and the access token is decoded without
 *   checking its signature, so `expires_at`, `exp`, `session_id` and
 *   `sub` only order work. A status code alone (a gateway's 401, a WAF's
 *   403, a misrouted 404) proves nothing either: only GoTrue's explicit
 *   error codes do.
 * - An accepted access token proves that token, and its claims. It does
 *   not prove the refresh token stored beside it: a cookie can pair one
 *   sign-in's access token with another's refresh token, and keeping that
 *   pair would hand the visitor the second sign-in at the next refresh.
 *   GoTrue has no way to look a refresh token up without consuming it, so
 *   a pair is only proven by a refresh the Auth API answered — and only
 *   such a pair is ever written to the canonical scope.
 * - A candidate is only deleted on the Auth API's word about its own
 *   tokens. Claiming the same user or sign-in as a verified session is
 *   not that: a cookie whose claims cannot be checked is left alone.
 *
 * Refreshing is a mutation: the token rotates, and a token two or more
 * rotations old presented again is reuse, which revokes every refresh
 * token of the sign-in. So access tokens are checked first, read-only; a
 * refresh is only attempted when exactly one candidate is left that the
 * Auth API has not ruled out — both of its tokens — so its result can be
 * kept without guessing about any other copy. With two or more such candidates nothing is
 * refreshed and nothing deleted: an accepted access token serves the
 * request as it is, and otherwise the visitor is offered an explicit
 * sign-out.
 */

type CookieToSet = { name: string; value: string; options: CookieOptions };

export type SessionResolution =
  /**
   * A refresh proved the surviving pair, and every other candidate was
   * refused by the Auth API: write it canonically, retire the rest.
   */
  | {
      status: "live";
      /** The proven session's cookies, to write in the canonical scope. */
      cookies: CookieToSet[];
      /** Anti-cache headers for those writes. */
      headers: Record<string, string>;
    }
  /**
   * An accepted access token can serve this request, but its pairing with
   * its refresh token is unproven, or another candidate was not ruled
   * out. The request reads that session; no cookie is written or deleted.
   */
  | { status: "pinned"; cookies: CookieToSet[] }
  /** Every candidate was refused by the Auth API about its own tokens. */
  | { status: "revoked" }
  /** Two accepted access tokens name different users. */
  | { status: "ambiguous" }
  /**
   * More than one candidate may still hold a live sign-in, and none can be
   * chosen without a refresh that might destroy another — or a refresh
   * contradicted its own cookie, or there are more copies than are ever
   * judged. Only an explicit sign-out settles it.
   */
  | { status: "unresolved" }
  /** No definitive answer right now (outage, timeout, concurrent refresh). */
  | { status: "unverifiable" };

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  cookieOptions: CookieOptionsWithName;
  /** Per Auth API request; defaults to `AUTH_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
  /**
   * Epoch milliseconds after which no further Auth API request is made;
   * an unsent request reads as no answer. Set by each entry point below
   * from its own budget unless the caller passes one.
   */
  deadline?: number;
};

/*
 * auth-js refreshes a session within 90 s of `expires_at`. A pinned
 * session must stay clear of that window for the whole request, or a
 * downstream client would refresh with a refresh token nobody proved.
 */
const ACCESS_HEADROOM_SECONDS = 120;

/*
 * At most this many candidates are judged, and at sign-out revoked. A
 * browser holds at most two scopes of one name plus a bare/chunked
 * variant, so real requests stay far under it. Past it, nothing is
 * concluded: resolution leaves every cookie as it is, and sign-out
 * reports itself incomplete.
 */
export const MAX_JUDGED_CANDIDATES = 4;

/*
 * Every Auth API call made here is a single attempt with its own
 * deadline — never auth-js's refresh, which retries for up to 30 s.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 3000;

/*
 * Aggregate budgets. Resolution makes at most one parallel round of
 * access checks plus one refresh; sign-out at most one parallel round of
 * sign-outs, then one refresh and one sign-out per candidate, in order.
 * Whatever the budget cuts off is reported as unknown — never as success
 * — and nothing is retried.
 */
export const RESOLUTION_BUDGET_MS = 5000;
export const SIGN_OUT_BUDGET_MS = 8000;

/* GoTrue's explicit refusals (auth-js `ErrorCode`). */
const SIGN_IN_GONE = new Set([
  "session_not_found",
  "session_expired",
  "user_not_found",
]);
const REFRESH_TOKEN_GONE = new Set(["refresh_token_not_found", ...SIGN_IN_GONE]);
const REFRESH_TOKEN_REUSED = "refresh_token_already_used";
const ACCESS_TOKEN_REFUSED = "bad_jwt";

type AuthAnswer =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string | null }
  /** No answer at all: network failure, timeout, unreadable body. */
  | { ok: false; status: 0; code: null };

/** One Auth API request: no retries, no session storage, no cookies. */
async function authRequest(
  config: SupabaseConfig,
  path: string,
  init: { method: "GET" | "POST"; jwt?: string; body?: unknown }
): Promise<AuthAnswer> {
  const headers: Record<string, string> = {
    apikey: config.supabaseKey,
    /* Error codes arrive as `code` from this API version on. */
    "X-Supabase-Api-Version": "2024-01-01",
  };

  if (init.jwt) headers.Authorization = `Bearer ${init.jwt}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const remaining =
    config.deadline === undefined ? Infinity : config.deadline - Date.now();

  if (remaining <= 0) {
    return { ok: false, status: 0, code: null };
  }

  let response: Response;

  try {
    response = await fetch(
      `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1${path}`,
      {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(
          Math.min(config.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS, remaining)
        ),
      }
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }

  let body: unknown = null;

  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (response.ok) {
    return { ok: true, status: response.status, body: record };
  }

  /* A legacy error body carries the HTTP status as a numeric `code`;
     only a string is an error code. */
  const code =
    typeof record.error_code === "string"
      ? record.error_code
      : typeof record.code === "string"
        ? record.code
        : null;

  return { ok: false, status: response.status, code };
}

type VerifiedAccess = {
  userId: string;
  sessionId: string | null;
  exp: number;
  /** The user object the Auth API returned for the token. */
  user: Record<string, unknown>;
};

type AccessVerdict =
  /** The Auth API accepted the token; its claims are now trustworthy. */
  | ({ kind: "live" } & VerifiedAccess)
  /** The token proves its sign-in is gone (its signature was checked). */
  | { kind: "gone" }
  /** Refused as a JWT (expired, malformed, forged): says nothing more. */
  | { kind: "refused" }
  | { kind: "unknown" };

/** Read-only: checks an access token with the Auth API. */
async function checkAccessToken(
  config: SupabaseConfig,
  accessToken: string
): Promise<AccessVerdict> {
  const answer = await authRequest(config, "/user", {
    method: "GET",
    jwt: accessToken,
  });

  if (answer.ok) {
    const claims = claimsOf(accessToken);

    return typeof answer.body.id === "string" &&
      typeof claims.exp === "number" &&
      /* The user the Auth API returned is the one the token names. */
      claims.sub === answer.body.id
      ? {
          kind: "live",
          userId: answer.body.id,
          sessionId:
            typeof claims.session_id === "string" ? claims.session_id : null,
          exp: claims.exp,
          user: answer.body,
        }
      : { kind: "unknown" };
  }

  if (answer.code && SIGN_IN_GONE.has(answer.code)) return { kind: "gone" };
  if (answer.code === ACCESS_TOKEN_REFUSED) return { kind: "refused" };

  return { kind: "unknown" };
}

type StoredSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: Record<string, unknown>;
};

type RefreshVerdict =
  | { kind: "live"; session: StoredSession }
  /** This refresh token yields no session: forged, or its sign-in ended. */
  | { kind: "gone" }
  /** Already rotated: GoTrue has treated this as reuse. */
  | { kind: "reused" }
  | { kind: "unknown" };

/** Rotates a refresh token. A mutation: see the module comment. */
async function refreshSession(
  config: SupabaseConfig,
  refreshToken: string,
  now: number
): Promise<RefreshVerdict> {
  if (!refreshToken) return { kind: "gone" };

  const answer = await authRequest(config, "/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });

  if (answer.ok) {
    const { body } = answer;

    if (
      typeof body.access_token !== "string" ||
      typeof body.refresh_token !== "string" ||
      typeof body.user !== "object" ||
      body.user === null
    ) {
      return { kind: "unknown" };
    }

    const expiresIn = Number(body.expires_in) || 3600;

    return {
      kind: "live",
      session: {
        access_token: body.access_token,
        token_type:
          typeof body.token_type === "string" ? body.token_type : "bearer",
        expires_in: expiresIn,
        expires_at:
          Number(body.expires_at) || Math.floor(now / 1000) + expiresIn,
        refresh_token: body.refresh_token,
        user: body.user as Record<string, unknown>,
      },
    };
  }

  if (answer.code === REFRESH_TOKEN_REUSED) return { kind: "reused" };
  if (answer.code && REFRESH_TOKEN_GONE.has(answer.code)) return { kind: "gone" };

  return { kind: "unknown" };
}

/* The scope the pre-existing sign-out used (auth-js's default): every
   sign-in of the user, on every device. Kept deliberately. */
type SignOutScope = "global" | "local";
const SIGN_OUT_SCOPE: SignOutScope = "global";

type LogoutVerdict =
  /** Signed out: every sign-in of the token's (verified) user is gone. */
  | "revoked"
  /** The token's sign-in no longer exists; the user's others may. */
  | "session-gone"
  /** The token's user no longer exists, nor any of their sign-ins. */
  | "user-gone"
  /** Refused as a JWT: says nothing about any sign-in. */
  | "refused"
  | "failed";

/** Revokes the sign-in an access token belongs to (`scope`). */
async function logOut(
  config: SupabaseConfig,
  accessToken: string,
  scope: SignOutScope
): Promise<LogoutVerdict> {
  const answer = await authRequest(config, `/logout?scope=${scope}`, {
    method: "POST",
    jwt: accessToken,
  });

  if (answer.ok) return "revoked";
  if (answer.code === "user_not_found") return "user-gone";
  if (answer.code && SIGN_IN_GONE.has(answer.code)) return "session-gone";
  if (answer.code === ACCESS_TOKEN_REFUSED) return "refused";

  return "failed";
}

/** A session stored exactly as @supabase/ssr stores one. */
function cookiesForSession(
  config: SupabaseConfig,
  session: StoredSession
): CookieToSet[] {
  return createChunks(
    config.cookieOptions.name ?? "",
    `base64-${stringToBase64URL(JSON.stringify(session))}`
  ).map(({ name, value }) => ({
    name,
    value,
    options: { ...DEFAULT_COOKIE_OPTIONS },
  }));
}

/**
 * What a pinned request carries: the accepted access token, its verified
 * expiry and user — never the cookie's own `expires_at` or cached user,
 * which nothing checked. The refresh token rides along unproven; the
 * headroom keeps any client from using it during this request.
 */
function pinnedCookies(
  config: SupabaseConfig,
  candidate: SessionCandidate,
  verified: VerifiedAccess,
  nowSeconds: number
) {
  return cookiesForSession(config, {
    access_token: candidate.accessToken,
    token_type: "bearer",
    expires_in: verified.exp - nowSeconds,
    expires_at: verified.exp,
    refresh_token: candidate.refreshToken,
    user: verified.user,
  });
}

/* Hint order: the later-looking generation first. Never evidence. */
function byNewestHint(candidates: SessionCandidate[]) {
  const hint = (candidate: SessionCandidate) =>
    candidate.tokenExpiresAt ?? candidate.expiresAt;

  return [...candidates].sort((a, b) => hint(b) - hint(a));
}

type Assessment = {
  candidate: SessionCandidate;
  verdict: AccessVerdict | { kind: "expired" };
  /** A `revocationOnly` pair: it may keep cookies alive, never serve. */
  ineligible: boolean;
};

export async function resolveSessionConflict(
  inventory: AuthCookieInventory,
  baseConfig: SupabaseConfig,
  { now = Date.now() }: { now?: number } = {}
): Promise<SessionResolution> {
  const config = {
    ...baseConfig,
    deadline: baseConfig.deadline ?? now + RESOLUTION_BUDGET_MS,
  };
  /* `revocationOnly` pairs are judged beside the candidates: a live one
     is another credential no settlement may delete, and an ambiguity
     like any other. None of them is ever pinned, refreshed or adopted. */
  const judged = [
    ...inventory.candidates.map((candidate) => ({ candidate, ineligible: false })),
    ...inventory.revocationOnly.map((candidate) => ({ candidate, ineligible: true })),
  ];

  /* Copies that were never judged might hold a live session. */
  if (inventory.candidatesTruncated || judged.length > MAX_JUDGED_CANDIDATES) {
    return { status: "unresolved" };
  }

  const nowSeconds = Math.floor(now / 1000);

  /* 1. Read-only: every access token that has not expired, in parallel.
        An expired-looking one is not worth asking about — a real token's
        `exp` is accurate, and a forged one is refused either way. */
  const assessments: Assessment[] = await Promise.all(
    judged.map(async ({ candidate, ineligible }) => ({
      candidate,
      ineligible,
      verdict:
        candidate.tokenExpiresAt !== null && candidate.tokenExpiresAt > nowSeconds
          ? await checkAccessToken(config, candidate.accessToken)
          : { kind: "expired" as const },
    }))
  );

  /* An indeterminate answer means the Auth API cannot be relied on right
     now: change nothing. */
  if (assessments.some(({ verdict }) => verdict.kind === "unknown")) {
    return { status: "unverifiable" };
  }

  const live = assessments.flatMap(({ candidate, verdict }) =>
    verdict.kind === "live" ? [{ candidate, verified: verdict }] : []
  );

  if (new Set(live.map(({ verified }) => verified.userId)).size > 1) {
    return { status: "ambiguous" };
  }

  /* An accepted access token may serve the request only with enough life
     left that no client refreshes it during the request, and only with a
     `session_id` tying the request to one sign-in. */
  const eligible = new Set(
    assessments.flatMap(({ candidate, ineligible }) =>
      ineligible ? [] : [candidate]
    )
  );
  const servable = live.filter(
    ({ candidate, verified }) =>
      eligible.has(candidate) &&
      verified.sessionId !== null &&
      verified.exp - nowSeconds > ACCESS_HEADROOM_SECONDS
  );
  const winner =
    servable.length > 0
      ? servable.reduce((best, entry) =>
          entry.verified.exp > best.verified.exp ? entry : best
        )
      : null;
  const pinned: SessionResolution | null = winner
    ? {
        status: "pinned",
        cookies: pinnedCookies(
          config,
          winner.candidate,
          winner.verified,
          nowSeconds
        ),
      }
    : null;

  /* 2. A candidate is ruled out only when both of its tokens are: its
        access token's sign-in is gone (the Auth API checked its
        signature), and its refresh token yields nothing. Those refresh
        tokens are presented now — a real pair's refresh token died with
        its sign-in, so this changes nothing. One that still works was
        another sign-in's: it is not adopted, and nothing is concluded. */
  const ruledOut = new Set<SessionCandidate>();

  for (const { candidate, verdict } of assessments) {
    if (verdict.kind !== "gone") continue;

    /* A half session's missing refresh token is no credential at all. */
    const probe = candidate.refreshToken
      ? await refreshSession(config, candidate.refreshToken, now)
      : ({ kind: "gone" } as const);

    if (probe.kind === "gone") {
      ruledOut.add(candidate);
    } else if (probe.kind === "live") {
      return { status: "unresolved" };
    } else {
      return pinned ?? { status: "unverifiable" };
    }
  }

  const open = assessments.filter(
    ({ candidate }) => !ruledOut.has(candidate)
  );

  if (open.length === 0) return { status: "revoked" };

  /* 3. Two or more open candidates: refreshing one could revoke another
        (reuse), and keeping its result would replace another in the
        canonical scope. An accepted access token can still serve the
        request; otherwise the visitor has to choose. Nothing changes. */
  if (open.length > 1) return pinned ?? { status: "unresolved" };

  /* 4. Exactly one open candidate. Its pair can only be proven against
        an access token the Auth API accepted in this request: that is
        what makes the token's `session_id` and `sub` evidence rather
        than claims. */
  const [{ candidate, verdict: access, ineligible }] = open;

  /* A grafted-profile pair is never refreshed or adopted: it stays as it
     is until a sign-out judges it. */
  if (ineligible) return pinned ?? { status: "unresolved" };

  if (access.kind === "live" && access.sessionId === null) {
    return { status: "unresolved" };
  }

  const refreshed = await refreshSession(config, candidate.refreshToken, now);

  if (refreshed.kind === "gone") {
    /* Its refresh token yields nothing. While its access token still
       works it is neither served (too close to expiry, or unbound) nor
       deleted; otherwise it holds no usable credential at all. */
    if (access.kind === "live") return pinned ?? { status: "unresolved" };
    return { status: "revoked" };
  }

  if (refreshed.kind !== "live") {
    /* Reuse, or no clear answer (including a timeout after which the
       Auth API may have rotated the token: presented again, it is the
       parent of the active token and GoTrue hands that back). A newer
       generation may exist that this request never saw. */
    return pinned ?? { status: "unverifiable" };
  }

  /* Nothing verified says which sign-in this refresh token belongs to:
     its access token has expired, or was refused, so its claims are just
     claims. The refreshed session is not adopted — the rotated token
     stays recoverable as the parent of the active one. */
  if (access.kind !== "live") {
    return { status: "unresolved" };
  }

  /* The refreshed pair is the Auth API's own. It is adopted only if it
     belongs to the same user and the same, non-null sign-in as the
     access token the Auth API accepted beside it. A cookie pairing one
     sign-in's access token with another's refresh token is neither
     adopted nor served. */
  const claims = claimsOf(refreshed.session.access_token);
  const refreshedSessionId =
    typeof claims.session_id === "string" ? claims.session_id : null;

  if (
    typeof claims.sub !== "string" ||
    refreshed.session.user.id !== claims.sub ||
    claims.sub !== access.userId ||
    refreshedSessionId === null ||
    refreshedSessionId !== access.sessionId
  ) {
    return { status: "unresolved" };
  }

  return {
    status: "live",
    cookies: cookiesForSession(config, refreshed.session),
    headers: { ...AUTH_NO_STORE_HEADERS },
  };
}

/**
 * Points a request's name-keyed cookies at the resolved session only, so
 * every reader downstream — the middleware's own client, Server Components,
 * route handlers — sees that one family and nothing it could refresh or
 * delete by mistake. Without a live or pinned session, the request
 * carries no session at all.
 */
export function pinResolvedSession(
  requestCookies: {
    set(name: string, value: string): unknown;
    delete(name: string): unknown;
  },
  inventory: AuthCookieInventory,
  resolution: SessionResolution
) {
  for (const name of inventory.session) {
    requestCookies.delete(name);
  }

  if (resolution.status === "live" || resolution.status === "pinned") {
    for (const { name, value } of resolution.cookies) {
      requestCookies.set(name, value);
    }
  }
}

/**
 * What a sign-out proved, at three levels.
 *
 * - `complete`: every credential the browser held (each access token and
 *   each refresh token) is confirmed unusable, and every user those
 *   credentials name was signed out of every device by a sign-out the
 *   Auth API confirmed. Only then may the visitor be told so.
 * - `local`: every credential the browser held is confirmed unusable,
 *   but some user could not be signed out everywhere — the browser held
 *   nothing that still worked for them, or held nothing at all. Local
 *   cookies are gone; sessions elsewhere are unknown.
 * - `incomplete`: some credential may still work (an error, a timeout, a
 *   reused refresh token, a copy past the budget, or legacy cookies this
 *   code cannot read). Never presented as success.
 */
export type RevocationStatus = "complete" | "local" | "incomplete";

export type RevocationReport = {
  status: RevocationStatus;
  /** Distinct readable sessions the browser sent. */
  candidates: number;
  /** Credentials a confirmed sign-out made unusable. */
  revoked: number;
  /** Credentials already unusable: expired, or refused with an explicit code. */
  alreadyInvalid: number;
  /** Credentials whose state is unknown. */
  uncertain: number;
  /** Candidates past `MAX_JUDGED_CANDIDATES`, or a truncated assembly. */
  skipped: number;
  /** Users a confirmed global sign-out covered. */
  usersSignedOut: number;
  /** Users the browser's credentials name that no confirmed sign-out covered. */
  usersUnconfirmed: number;
  /** Legacy Supabase auth cookies, never read or revoked here. */
  legacyCookies: number;
};

type Credential = "revoked" | "invalid" | "uncertain";

/**
 * Server-side sign-out for every credential the browser holds, within
 * `SIGN_OUT_BUDGET_MS` of Auth API work, and never through auth-js's
 * `signOut` (which reports success on 401, 403 and 404).
 *
 * Access tokens, refresh tokens and users are accounted separately: a
 * cookie may pair one sign-in's access token with another's refresh
 * token, so signing out the user behind one says nothing about the
 * other.
 *
 * 1. Every unexpired access token signs out (`global`), in parallel. An
 *    accepted one proves its user, who is then signed out everywhere.
 * 2. Every refresh token is presented, newest-looking first. Most are
 *    gone by now (signing out deletes sign-ins and their refresh
 *    tokens); one that still works yields a fresh access token naming
 *    its user, which signs out too.
 *
 * An expired or refused access token is an unusable credential, but not
 * proof that its user's sessions ended. Its `sub` is read without
 * verification only to ask whether a confirmed sign-out already covered
 * that user: a real token's claims are true, so if it names a user who
 * was signed out everywhere, its session ended with them; a forged one
 * is no credential at all. A user it names whom no confirmed sign-out
 * covered stays unconfirmed — never assumed signed out because another
 * user was.
 *
 * The caller clears every local cookie whatever this reports. Access
 * tokens issued before the sign-out stay valid for JWT-only verifiers
 * until they expire.
 */
export async function revokeSessionCandidates(
  inventory: AuthCookieInventory,
  baseConfig: SupabaseConfig,
  { now = Date.now() }: { now?: number } = {}
): Promise<RevocationReport> {
  const config = {
    ...baseConfig,
    deadline: baseConfig.deadline ?? now + SIGN_OUT_BUDGET_MS,
  };
  const nowSeconds = Math.floor(now / 1000);
  /* Grafted-profile pairs are credentials too: each is judged on its own
     tokens, and `userId` is already the token's `sub`. */
  const credentialSets = [...inventory.candidates, ...inventory.revocationOnly];
  const judged = byNewestHint(credentialSets.slice(0, MAX_JUDGED_CANDIDATES));
  const skipped =
    credentialSets.length -
    judged.length +
    (inventory.candidatesTruncated ? 1 : 0);
  const credentials: Credential[] = [];
  /** Users a confirmed global sign-out (or the user's deletion) covers. */
  const signedOut = new Set<string>();
  /** Users the Auth API vouched for, whatever happened to them. */
  const verifiedUsers = new Set<string>();
  /** Users only an unverified token names; null for a token naming none. */
  const claimedUsers = new Set<string | null>();

  /* 1. Access tokens, in parallel. */
  const accessResults = await Promise.all(
    judged.map(async (candidate) =>
      candidate.tokenExpiresAt === null ||
      candidate.tokenExpiresAt <= nowSeconds
        ? null
        : logOut(config, candidate.accessToken, SIGN_OUT_SCOPE)
    )
  );

  judged.forEach((candidate, index) => {
    /* A half session without an access token: only its refresh token
       is a credential, judged below. */
    if (!candidate.accessToken) return;

    const verdict = accessResults[index];
    /* Evidence only when the answer checked the token's signature. */
    const sub = claimsOf(candidate.accessToken).sub;
    const verifiedSub = typeof sub === "string" ? sub : null;

    switch (verdict) {
      case "revoked":
      case "user-gone":
        credentials.push(verdict === "revoked" ? "revoked" : "invalid");
        if (verifiedSub) {
          verifiedUsers.add(verifiedSub);
          signedOut.add(verifiedSub);
        }
        return;
      case "session-gone":
        credentials.push("invalid");
        if (verifiedSub) verifiedUsers.add(verifiedSub);
        return;
      case "failed":
        credentials.push("uncertain");
        claimedUsers.add(candidate.userId);
        return;
      default:
        /* Expired, or refused as a JWT. */
        credentials.push("invalid");
        claimedUsers.add(candidate.userId);
    }
  });

  /* 2. Refresh tokens, in order. */
  for (const candidate of judged) {
    if (!candidate.refreshToken) continue;

    const refreshed = await refreshSession(config, candidate.refreshToken, now);

    if (refreshed.kind === "gone") {
      credentials.push("invalid");
      continue;
    }

    if (refreshed.kind !== "live") {
      credentials.push("uncertain");
      continue;
    }

    /* Issued by the Auth API just now: its user is evidence. */
    const user = claimsOf(refreshed.session.access_token).sub;
    if (typeof user === "string") verifiedUsers.add(user);

    const verdict = await logOut(
      config,
      refreshed.session.access_token,
      SIGN_OUT_SCOPE
    );

    if (verdict === "revoked" || verdict === "user-gone") {
      credentials.push(verdict === "revoked" ? "revoked" : "invalid");
      if (typeof user === "string") signedOut.add(user);
    } else if (verdict === "session-gone") {
      credentials.push("invalid");
    } else {
      credentials.push("uncertain");
    }
  }

  const users = new Set<string | null>([...verifiedUsers, ...claimedUsers]);
  const unconfirmed = [...users].filter(
    (user) => user === null || !signedOut.has(user)
  ).length;
  const count = (credential: Credential) =>
    credentials.filter((value) => value === credential).length;
  const uncertain = count("uncertain");

  const status: RevocationStatus =
    uncertain > 0 || skipped > 0 || inventory.legacy.length > 0
      ? "incomplete"
      : users.size > 0 && unconfirmed === 0
        ? "complete"
        : "local";

  return {
    status,
    candidates: credentialSets.length,
    revoked: count("revoked"),
    alreadyInvalid: count("invalid"),
    uncertain,
    skipped,
    usersSignedOut: signedOut.size,
    usersUnconfirmed: unconfirmed,
    legacyCookies: inventory.legacy.length,
  };
}
