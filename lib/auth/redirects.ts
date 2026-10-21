import {
  COMMAND_CENTER_PATH,
  getCommandCenterUrl,
  getEcosystemAppUrl,
  getEcosystemSiteUrl,
  getUrlOrigin,
} from "@/lib/config/ecosystem";

export const APP_HOME_PATH = "/dashboard";
export const LOGIN_PATH = "/auth/login";
export const LOGOUT_PATH = "/auth/logout";
/* Sign-out confirmation and session recovery: a page, since the
   logout route itself only signs out on POST. */
export const SESSION_RECOVERY_PATH = `${LOGOUT_PATH}/confirm`;
export const SIGNUP_PATH = "/auth/signup";
export const CHECK_EMAIL_PATH = "/auth/check-email";
export const ACCESS_DENIED_PATH = "/access-denied";
export const SHARED_LOGIN_PATH = "/login";
export const SHARED_SIGNUP_PATH = "/sign-up";
export const SHARED_VERIFY_EMAIL_PATH = "/verify-email";
export const ONBOARDING_PATH = "/onboarding";
const SAFE_SHARED_AUTH_FALLBACK_PATH = "/";

type SearchParamValue = string | string[] | undefined;

export function sanitizeAuthRedirectPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return APP_HOME_PATH;
  }

  return nextPath;
}

function buildArchitectaAppHref(nextPath: string) {
  const appUrl = getEcosystemAppUrl("architecta");

  if (!appUrl) {
    return undefined;
  }

  try {
    return new URL(sanitizeAuthRedirectPath(nextPath), appUrl).toString();
  } catch {
    return undefined;
  }
}

function buildCommandCenterHref() {
  return getCommandCenterUrl();
}

export function sanitizeSharedAuthNextUrl(nextTarget?: string | null) {
  const commandCenterHref = buildCommandCenterHref();
  const fallbackHref = commandCenterHref;

  if (!nextTarget) {
    return fallbackHref;
  }

  if (nextTarget === COMMAND_CENTER_PATH) {
    return commandCenterHref;
  }

  if (nextTarget.startsWith("/")) {
    return buildArchitectaAppHref(nextTarget) ?? fallbackHref;
  }

  try {
    const candidate = new URL(nextTarget);
    const architectaOrigin = getUrlOrigin(getEcosystemAppUrl("architecta"));
    const authOrigin = getUrlOrigin(getEcosystemSiteUrl());

    if (
      (candidate.origin !== architectaOrigin &&
        candidate.origin !== authOrigin) ||
      (candidate.protocol !== "http:" && candidate.protocol !== "https:")
    ) {
      return fallbackHref;
    }

    return candidate.toString();
  } catch {
    return fallbackHref;
  }
}

export function sanitizePostAuthRedirectPath(nextTarget?: string | null) {
  if (!nextTarget) {
    return APP_HOME_PATH;
  }

  if (nextTarget.startsWith("/")) {
    return sanitizeAuthRedirectPath(nextTarget);
  }

  try {
    const candidate = new URL(nextTarget);
    const architectaOrigin = getUrlOrigin(getEcosystemAppUrl("architecta"));

    if (architectaOrigin && candidate.origin === architectaOrigin) {
      return sanitizeAuthRedirectPath(
        `${candidate.pathname}${candidate.search}${candidate.hash}`
      );
    }
  } catch {
    return APP_HOME_PATH;
  }

  return APP_HOME_PATH;
}

function buildPathWithQuery(
  path: string,
  params?: Record<string, SearchParamValue>
) {
  const searchParams = new URLSearchParams();

  if (params) {
    for (const [key, rawValue] of Object.entries(params)) {
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

      if (!value) {
        continue;
      }

      const sanitizedValue =
        key === "next" ? sanitizeSharedAuthNextUrl(value) : value;

      if (!sanitizedValue) {
        continue;
      }

      searchParams.set(key, sanitizedValue);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function buildSharedAuthHref(
  path: string,
  params?: Record<string, SearchParamValue>
) {
  const relativePath = buildPathWithQuery(path, params);
  const baseUrl = getEcosystemSiteUrl();

  if (!baseUrl) {
    return SAFE_SHARED_AUTH_FALLBACK_PATH;
  }

  const targetUrl = new URL(relativePath, baseUrl);
  const sharedOrigin = getUrlOrigin(baseUrl);
  const architectaOrigin = getUrlOrigin(getEcosystemAppUrl("architecta"));

  if (
    sharedOrigin &&
    architectaOrigin &&
    sharedOrigin === architectaOrigin &&
    targetUrl.origin === architectaOrigin
  ) {
    return SAFE_SHARED_AUTH_FALLBACK_PATH;
  }

  return targetUrl.toString();
}

export function hasSharedAuthLoopRisk(currentUrl: string | URL, targetHref: string) {
  if (targetHref.startsWith("/")) {
    return true;
  }

  const current =
    typeof currentUrl === "string" ? new URL(currentUrl) : currentUrl;
  const target = new URL(targetHref);

  return current.origin === target.origin;
}

export function buildSharedLoginHref(nextPath?: string | null) {
  return buildSharedAuthHref(SHARED_LOGIN_PATH, {
    next: sanitizeSharedAuthNextUrl(nextPath),
  });
}

export function buildSharedSignupHref(nextPath?: string | null) {
  return buildSharedAuthHref(SHARED_SIGNUP_PATH, {
    next: sanitizeSharedAuthNextUrl(nextPath),
  });
}

export function buildSharedVerifyEmailHref(nextPath?: string | null) {
  return buildSharedAuthHref(SHARED_VERIFY_EMAIL_PATH, {
    next: sanitizeSharedAuthNextUrl(nextPath),
  });
}

export function getPostAuthRedirectPath(
  onboardingComplete: boolean,
  nextPath?: string | null
) {
  if (!onboardingComplete) {
    return ONBOARDING_PATH;
  }

  const safeNextPath = sanitizePostAuthRedirectPath(nextPath);

  if (
    safeNextPath.startsWith("/auth") ||
    safeNextPath === ACCESS_DENIED_PATH ||
    safeNextPath === ONBOARDING_PATH
  ) {
    return APP_HOME_PATH;
  }

  return safeNextPath;
}

/** Why the visitor was sent to the session recovery page. */
export type SessionRecoveryReason =
  /** Two accepted sessions name different accounts. */
  | "session-conflict"
  /** Several saved sessions, none of which can be chosen safely. */
  | "session-unresolved"
  /** The Auth API could not be reached to check them. */
  | "auth-unavailable";

export const SESSION_RECOVERY_REASONS: readonly SessionRecoveryReason[] = [
  "session-conflict",
  "session-unresolved",
  "auth-unavailable",
];

export function buildSessionRecoveryHref(
  reason: SessionRecoveryReason,
  nextPath?: string | null
) {
  const params = new URLSearchParams({ reason });

  if (nextPath) {
    params.set("next", sanitizePostAuthRedirectPath(nextPath));
  }

  return `${SESSION_RECOVERY_PATH}?${params.toString()}`;
}
