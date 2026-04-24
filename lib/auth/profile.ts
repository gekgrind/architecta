import type { User } from "@supabase/supabase-js";

export type SharedProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  onboarding_complete?: boolean | null;
  plan?: string | null;
  app_access?: unknown;
  entitled_apps?: unknown;
  architecta_access?: boolean | null;
  workspace_name?: string | null;
  [key: string]: unknown;
};

export function getDisplayName(
  user: Pick<User, "email" | "user_metadata"> | null,
  profile?: SharedProfile | null
) {
  const profileName =
    typeof profile?.full_name === "string" ? profile.full_name : null;
  const userName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  return profileName || userName || user?.email?.split("@")[0] || "User";
}

export function getAvatarUrl(
  user: Pick<User, "user_metadata"> | null,
  profile?: SharedProfile | null
) {
  const profileAvatar =
    typeof profile?.avatar_url === "string" ? profile.avatar_url : null;
  const userAvatar =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;

  return profileAvatar || userAvatar || undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value.filter(
    (entry): entry is string => typeof entry === "string"
  );

  return strings.length ? strings : null;
}

export function hasArchitectaAccess(profile?: SharedProfile | null) {
  if (!profile) {
    return true;
  }

  if (typeof profile.architecta_access === "boolean") {
    return profile.architecta_access;
  }

  const appAccess = normalizeStringArray(profile.app_access);
  if (appAccess) {
    return appAccess.includes("architecta");
  }

  const entitledApps = normalizeStringArray(profile.entitled_apps);
  if (entitledApps) {
    return entitledApps.includes("architecta");
  }

  return true;
}
