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

type IdentityUser = Pick<User, "email" | "user_metadata">;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readString(record: UnknownRecord | null, key: string) {
  const value = record?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function profileRecord(profile?: SharedProfile | null) {
  return asRecord(profile);
}

function profileNestedRecord(profile: SharedProfile | null | undefined, key: string) {
  return asRecord(profile?.[key]);
}

function userMetadataRecord(user: IdentityUser | null) {
  return asRecord(user?.user_metadata);
}

function identityRecords(user: IdentityUser | null, profile?: SharedProfile | null) {
  return [
    profileRecord(profile),
    profileNestedRecord(profile, "ecosystem_metadata"),
    profileNestedRecord(profile, "founder_profile"),
    profileNestedRecord(profile, "onboarding_responses"),
    userMetadataRecord(user),
  ];
}

function firstIdentityString(
  records: Array<UnknownRecord | null>,
  keys: string[]
) {
  for (const record of records) {
    for (const key of keys) {
      const value = readString(record, key);

      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

export function getDisplayName(
  user: IdentityUser | null,
  profile?: SharedProfile | null
) {
  const records = identityRecords(user, profile);

  return (
    firstIdentityString(records, ["full_name", "name", "founder_name"]) ||
    user?.email?.split("@")[0] ||
    "Founder"
  );
}

export function getAvatarUrl(
  user: Pick<User, "user_metadata"> | null,
  profile?: SharedProfile | null
) {
  return firstIdentityString(identityRecords(user as IdentityUser | null, profile), [
    "avatar_url",
    "avatarUrl",
    "picture",
    "image",
  ]);
}

export function getProfileTitle(
  user: IdentityUser | null,
  profile?: SharedProfile | null
) {
  const records = identityRecords(user, profile);

  return (
    firstIdentityString(records, [
      "title",
      "role",
      "job_title",
      "jobTitle",
      "founder_role",
      "workspace_name",
    ]) || "Founder"
  );
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
