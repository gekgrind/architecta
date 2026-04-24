const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";

export function sanitizeAuthRedirectPath(nextPath: string | null | undefined) {
  if (!nextPath) return DEFAULT_AUTH_REDIRECT_PATH;
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
  return nextPath;
}
