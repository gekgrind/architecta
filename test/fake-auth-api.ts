import { createChunks, stringToBase64URL } from "@supabase/ssr";

import { ONBOARDING_SESSION_STATUS } from "@/lib/onboarding/gate";
import { ENTREPRENEURIA_AUTH_COOKIE_NAME } from "@/lib/supabase/cookies";

import type { BrowserCookieJar, Scope } from "./browser-cookie-jar";

/*
 * A stubbed Supabase Auth (GoTrue) + PostgREST API for driving the real
 * middleware and auth routes. Every token is a fake, unsigned
 * placeholder; nothing touches the network.
 *
 * It keeps GoTrue's server-side state, not a call log, modelled on
 * supabase/auth `internal/api/token_refresh.go`, `logout.go` and
 * `auth.go`:
 *
 * - A sign-in is a `sessions` row owned by a user. `/logout` deletes rows:
 *   `global` every row of the user, `local` the token's own, `others`
 *   the rest. Deleting a row cascades to its refresh tokens.
 * - `/user` and `/logout` check the JWT (signature, expiry), then load
 *   the session its `session_id` names: a deleted one answers
 *   `session_not_found`. A JWT-only verifier (PostgREST, `getClaims`
 *   against JWKS) does not load the session, so a revoked sign-in's
 *   access token stays usable there until it expires —
 *   `acceptsJwtLocally` models that.
 * - Refresh tokens rotate: the presented one is revoked and a child is
 *   issued. A revoked one presented again is answered, in order, by:
 *   the parent-of-active exception (it is the parent of the session's
 *   active token: the active token is returned, nothing rotates); the
 *   reuse interval (revoked within `reuseIntervalSeconds`: a new child
 *   is issued); otherwise reuse — every refresh token of the session is
 *   revoked and `refresh_token_already_used` returned. Reuse revokes
 *   refresh tokens only; the session row, and access tokens issued for
 *   it, live on until they expire.
 *
 * Simulated, not verified here — needs a real Supabase integration test:
 * JWT signature and key rotation, rate limits, refresh-token expiry by
 * session time-box or inactivity, and exact HTTP statuses beyond the
 * documented `error_code`s used below.
 */

export const SUPABASE_URL = "https://project-ref.supabase.co";
export const KEY = ENTREPRENEURIA_AUTH_COOKIE_NAME;
export const USER_ID = "00000000-0000-4000-8000-000000000001";
export const OTHER_USER_ID = "00000000-0000-4000-8000-0000000000f2";
export const DEFAULT_SESSION_ID = "00000000-0000-4000-8000-000000000002";

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * An access token as GoTrue shapes one. Built here it is a forgery the
 * fake API refuses (`bad_jwt`) unless it was issued through `generation`
 * or a refresh; `session_id` names one sign-in and survives its refreshes.
 */
export function fakeAccessToken({
  sessionId = DEFAULT_SESSION_ID,
  userId = USER_ID,
  expiresIn = 3600,
  omitSessionId = false,
}: {
  sessionId?: string;
  userId?: string;
  expiresIn?: number;
  omitSessionId?: boolean;
} = {}) {
  const now = nowSeconds();

  return [
    base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        sub: userId,
        aud: "authenticated",
        role: "authenticated",
        iat: now + expiresIn - 3600,
        exp: now + expiresIn,
        ...(omitSessionId ? {} : { session_id: sessionId }),
        /* Distinguishes tokens minted in the same second. */
        jti: Math.random().toString(36).slice(2),
      })
    ),
    "fake-signature",
  ].join(".");
}

/* Provider identity metadata is what pushes a session past one chunk. */
export function fakeUser(bulky: boolean, userId = USER_ID) {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email:
      userId === USER_ID ? "founder@example.com" : `${userId.slice(-4)}@example.com`,
    app_metadata: { provider: "google" },
    user_metadata: bulky ? { bio: "b".repeat(3000) } : {},
    created_at: "2026-01-01T00:00:00Z",
  };
}

type IssuedAccessToken = {
  /** Null for a token issued without a `session_id` claim. */
  sessionId: string | null;
  /** The row the token was issued for, whatever its claims say. */
  rowId: string;
  userId: string;
  exp: number;
};

type IssuedRefreshToken = {
  sessionId: string;
  userId: string;
  parent: string | null;
  revoked: boolean;
  /** Milliseconds; when it was issued or last revoked. */
  updatedAt: number;
  /** Issue order within the whole API, for "currently active". */
  serial: number;
};

export type FakeAuthApi = ReturnType<typeof installFakeAuthApi>;

type Mode =
  | "up"
  /** The network fails. */
  | "down"
  /** The Auth API answers 503. */
  | "unavailable"
  /** A gateway in front answers a bare 401 / 403 / 404, no error code. */
  | "gateway-401"
  | "gateway-403"
  | "gateway-404";

export function installFakeAuthApi() {
  const accessTokens = new Map<string, IssuedAccessToken>();
  const refreshTokens = new Map<string, IssuedRefreshToken>();
  /** Session rows that exist. A deleted sign-in is simply absent. */
  const sessions = new Map<string, { userId: string }>();
  let serial = 0;

  const state = {
    accessToken: "",
    mode: "up" as Mode,
    /**
     * Answer `/logout` with this status, deleting nothing: always, or for
     * the tokens a function picks.
     */
    logoutFailure: null as
      | null
      | number
      | ((accessToken: string) => number | null),
    /** GoTrue's `REFRESH_TOKEN_REUSE_INTERVAL` (default 10 s). */
    reuseIntervalSeconds: 10,
    /** Whether a refreshed session is big enough to need several chunks. */
    refreshBulky: false,
    onboardingComplete: true,
    architectaAccess: true,
    refreshCalls: 0,
    /** Refresh tokens actually rotated (a new child issued). */
    rotations: 0,
    logoutCalls: 0,
    validatedTokens: [] as string[],
    reuseDetected: false,
    refreshedTokens: [] as string[],
    loggedOutTokens: [] as string[],
    logoutScopes: [] as string[],
  };

  function issueAccessToken({
    sessionId,
    userId,
    expiresIn = 3600,
    omitSessionId = false,
  }: {
    sessionId: string;
    userId: string;
    expiresIn?: number;
    omitSessionId?: boolean;
  }) {
    const token = fakeAccessToken({ sessionId, userId, expiresIn, omitSessionId });
    accessTokens.set(token, {
      sessionId: omitSessionId ? null : sessionId,
      rowId: sessionId,
      userId,
      exp: nowSeconds() + expiresIn,
    });

    return token;
  }

  function issueRefreshToken(
    token: string,
    sessionId: string,
    userId: string,
    parent: string | null = null
  ) {
    refreshTokens.set(token, {
      sessionId,
      userId,
      parent,
      revoked: false,
      updatedAt: Date.now(),
      serial: (serial += 1),
    });
  }

  function startSession(sessionId: string, userId: string) {
    sessions.set(sessionId, { userId });
  }

  function deleteSession(sessionId: string) {
    sessions.delete(sessionId);

    /* ON DELETE CASCADE. */
    for (const [token, issued] of refreshTokens) {
      if (issued.sessionId === sessionId) refreshTokens.delete(token);
    }
  }

  /** `session.FindCurrentlyActiveRefreshToken`: the newest unrevoked. */
  function activeRefreshToken(sessionId: string) {
    let active: [string, IssuedRefreshToken] | null = null;

    for (const entry of refreshTokens) {
      if (
        entry[1].sessionId === sessionId &&
        !entry[1].revoked &&
        (!active || entry[1].serial > active[1].serial)
      ) {
        active = entry;
      }
    }

    return active;
  }

  /* The default sign-in most tests start from. */
  startSession(DEFAULT_SESSION_ID, USER_ID);
  state.accessToken = issueAccessToken({
    sessionId: DEFAULT_SESSION_ID,
    userId: USER_ID,
  });
  issueRefreshToken("fake-refresh-token", DEFAULT_SESSION_ID, USER_ID);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const authError = (code: string, status: number) =>
    json({ error_code: code, msg: code }, status);

  /** `requireAuthentication` + `maybeLoadUserOrSession`. */
  function authenticate(token: string) {
    const issued = accessTokens.get(token);

    if (!issued || issued.exp <= nowSeconds()) {
      return { error: authError("bad_jwt", 403) };
    }

    if (issued.sessionId && !sessions.has(issued.sessionId)) {
      return { error: authError("session_not_found", 403) };
    }

    return { issued };
  }

  function sessionResponse(sessionId: string, userId: string, refreshToken: string) {
    state.accessToken = issueAccessToken({ sessionId, userId });

    return json({
      access_token: state.accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: nowSeconds() + 3600,
      refresh_token: refreshToken,
      user: fakeUser(state.refreshBulky, userId),
    });
  }

  function refresh(presentedToken: string) {
    const presented = refreshTokens.get(presentedToken);

    if (!presented || !sessions.has(presented.sessionId)) {
      return authError("refresh_token_not_found", 400);
    }

    const { sessionId, userId } = presented;

    if (presented.revoked) {
      const active = activeRefreshToken(sessionId);

      /* Parent-of-active: the client never stored the last rotation. */
      if (active && active[1].parent === presentedToken) {
        return sessionResponse(sessionId, userId, active[0]);
      }

      if (Date.now() - presented.updatedAt > state.reuseIntervalSeconds * 1000) {
        /* Reuse: RevokeTokenFamily. The session row survives. */
        state.reuseDetected = true;
        for (const issued of refreshTokens.values()) {
          if (issued.sessionId === sessionId) issued.revoked = true;
        }

        return authError("refresh_token_already_used", 400);
      }
      /* Within the reuse interval: swap again, below. */
    }

    presented.revoked = true;
    presented.updatedAt = Date.now();
    state.rotations += 1;
    const child = `fake-refresh-token-${(serial += 1)}`;
    issueRefreshToken(child, sessionId, userId, presentedToken);

    return sessionResponse(sessionId, userId, child);
  }

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(
      input instanceof Request ? input.headers : init?.headers
    );
    const bearer = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";

    if (state.mode === "down") {
      throw new TypeError("fetch failed");
    }

    if (state.mode === "unavailable") {
      return json({ message: "service unavailable" }, 503);
    }

    if (url.pathname.startsWith("/auth/v1/") && state.mode.startsWith("gateway-")) {
      const status = Number(state.mode.slice("gateway-".length));
      return json({ message: "blocked upstream" }, status);
    }

    if (url.pathname === "/auth/v1/token") {
      state.refreshCalls += 1;
      const body = JSON.parse(String(init?.body ?? "{}"));
      state.refreshedTokens.push(body.refresh_token);

      return refresh(body.refresh_token);
    }

    if (url.pathname === "/auth/v1/user") {
      state.validatedTokens.push(bearer);
      const { issued, error } = authenticate(bearer);

      return issued ? json(fakeUser(false, issued.userId)) : error;
    }

    if (url.pathname === "/auth/v1/logout") {
      state.logoutCalls += 1;
      state.loggedOutTokens.push(bearer);

      const failure =
        typeof state.logoutFailure === "function"
          ? state.logoutFailure(bearer)
          : state.logoutFailure;

      if (failure) {
        return json({ message: "logout failed" }, failure);
      }

      const { issued, error } = authenticate(bearer);
      if (!issued) return error;

      const scope = url.searchParams.get("scope") ?? "global";
      state.logoutScopes.push(scope);

      for (const [sessionId, { userId }] of [...sessions]) {
        const own = sessionId === issued.rowId;

        if (
          userId === issued.userId &&
          (scope === "global" ||
            (scope === "local" && own) ||
            (scope === "others" && !own))
        ) {
          deleteSession(sessionId);
        }
      }

      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/rest/v1/profiles") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? USER_ID;
      return json([{ id, architecta_access: state.architectaAccess }]);
    }

    if (url.pathname === "/rest/v1/onboarding_sessions") {
      return json(
        state.onboardingComplete
          ? [{ status: ONBOARDING_SESSION_STATUS.completed }]
          : []
      );
    }

    return json({ message: `unexpected request ${url.pathname}` }, 404);
  }) as typeof fetch;

  /** A session as auth-js stores it, `expiresIn` seconds from now. */
  function storedSession({
    refreshToken = "fake-refresh-token",
    expiresIn = 3600,
    bulky = true,
    token = state.accessToken,
    userId = USER_ID,
  }: {
    refreshToken?: string;
    expiresIn?: number;
    bulky?: boolean;
    token?: string;
    userId?: string;
  } = {}) {
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at: nowSeconds() + expiresIn,
      refresh_token: refreshToken,
      user: fakeUser(bulky, userId),
    };
  }

  let generations = 0;

  /**
   * One sign-in's stored session at one point of its refresh chain. The
   * sign-in is started on first use; `revoked: true` deletes it.
   */
  function generation({
    sessionId,
    userId = USER_ID,
    expiresIn = 3600,
    accessLive = true,
    refreshLive = true,
    consumed = false,
    bulky = false,
    omitSessionId = false,
  }: {
    sessionId: string;
    userId?: string;
    expiresIn?: number;
    /** False: a JWT the Auth API refuses outright (e.g. a rotated key). */
    accessLive?: boolean;
    /** False: a refresh token GoTrue has no row for. */
    refreshLive?: boolean;
    /** Its refresh token was rotated long ago, and is no one's parent. */
    consumed?: boolean;
    bulky?: boolean;
    /** A token without a `session_id` claim. */
    omitSessionId?: boolean;
  }) {
    generations += 1;
    if (!sessions.has(sessionId)) startSession(sessionId, userId);

    const token = accessLive
      ? issueAccessToken({ sessionId, userId, expiresIn, omitSessionId })
      : fakeAccessToken({ sessionId, userId, expiresIn, omitSessionId });
    const refreshToken = `refresh-${sessionId.slice(-2)}-${generations}`;

    if (refreshLive || consumed) {
      issueRefreshToken(refreshToken, sessionId, userId);
    }
    if (consumed) {
      const issued = refreshTokens.get(refreshToken)!;
      issued.revoked = true;
      issued.updatedAt = 0;
    }

    return storedSession({ refreshToken, expiresIn, bulky, token, userId });
  }

  /**
   * A copy planted by someone else: a well-formed but unsigned token
   * claiming any sign-in and expiry, and a refresh token the API never
   * issued.
   */
  function forgedSession({
    sessionId,
    userId = USER_ID,
    expiresIn = 7200,
    bulky = false,
  }: {
    sessionId: string;
    userId?: string;
    expiresIn?: number;
    bulky?: boolean;
  }) {
    generations += 1;

    return storedSession({
      token: fakeAccessToken({ sessionId, userId, expiresIn }),
      refreshToken: `forged-refresh-${generations}`,
      expiresIn,
      bulky,
      userId,
    });
  }

  return {
    state,
    fetchStub,
    storedSession,
    generation,
    forgedSession,
    /** Revokes a sign-in server-side, as an admin sign-out would. */
    revokeSession: deleteSession,
    /** Whether the sign-in's row still exists (it was not signed out). */
    isLive: (sessionId: string) => sessions.has(sessionId),
    /** Sign-ins of a user that still exist. */
    liveSessionsOf: (userId: string) =>
      [...sessions].flatMap(([sessionId, row]) =>
        row.userId === userId ? [sessionId] : []
      ),
    /** The sign-in an issued access token belongs to. */
    sessionOf: (token: string) => accessTokens.get(token)?.rowId ?? null,
    /** Whether any refresh token of the sign-in can still be used. */
    canRefresh: (sessionId: string) => activeRefreshToken(sessionId) !== null,
    /** What a JWT-only verifier would accept: signature and expiry only. */
    acceptsJwtLocally: (token: string) => {
      const issued = accessTokens.get(token);
      return Boolean(issued && issued.exp > nowSeconds());
    },
  };
}

/** A session serialized and chunked by @supabase/ssr itself. */
export function sessionChunks(session: Record<string, unknown>) {
  return createChunks(
    KEY,
    `base64-${stringToBase64URL(JSON.stringify(session))}`
  );
}

export function plant(
  jar: BrowserCookieJar,
  session: Record<string, unknown>,
  scope: Scope
) {
  for (const { name, value } of sessionChunks(session)) {
    jar.set(name, value, scope);
  }
}
