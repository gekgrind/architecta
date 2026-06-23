import { Settings } from "lucide-react";

import type {
  ResolvedSidebarUserIdentity,
  SidebarNavigationItem,
  SidebarUser,
} from "@/lib/navigation/types";

type BuildSidebarNavigationOptions = {
  commandCenterHref: string;
  commandCenterLabel?: string;
};

const COMMAND_CENTER_LABEL = "Command Center";
const USER_NAME_FALLBACK = "Founder";
const USER_TITLE_FALLBACK = "Founder";

function isCommandCenterItem(item: SidebarNavigationItem) {
  return item.label.trim().toLowerCase() === COMMAND_CENTER_LABEL.toLowerCase();
}

export function buildSidebarNavigation(
  items: SidebarNavigationItem[],
  options: BuildSidebarNavigationOptions
): SidebarNavigationItem[] {
  const appItems = items.filter((item) => !isCommandCenterItem(item));

  return [
    ...appItems,
    {
      label: options.commandCenterLabel ?? COMMAND_CENTER_LABEL,
      href: options.commandCenterHref,
      icon: Settings,
      external: options.commandCenterHref.startsWith("http"),
    },
  ];
}

function firstNonEmptyString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function getFallbackInitials(name: string, email?: string | null) {
  const source = name !== USER_NAME_FALLBACK ? name : email;
  const cleanSource = source?.trim();

  if (!cleanSource) {
    return "F";
  }

  const localPart = cleanSource.includes("@")
    ? cleanSource.split("@")[0]
    : cleanSource;
  const words = localPart.split(/[\s._-]+/).filter(Boolean);

  if (!words.length) {
    return "F";
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "F"
  );
}

export function resolveSidebarUserIdentity(
  user?: SidebarUser | null
): ResolvedSidebarUserIdentity {
  const name =
    firstNonEmptyString(user?.fullName, user?.name, user?.email) ??
    USER_NAME_FALLBACK;
  const title =
    firstNonEmptyString(user?.title, user?.role) ?? USER_TITLE_FALLBACK;
  const avatarUrl = firstNonEmptyString(user?.avatarUrl);

  return {
    avatarUrl,
    name,
    title,
    initials: getFallbackInitials(name, user?.email),
  };
}
