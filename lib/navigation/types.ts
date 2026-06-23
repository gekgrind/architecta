import type { ComponentType, SVGProps } from "react";

export type SidebarIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type SidebarNavigationItem = {
  label: string;
  href: string;
  icon: SidebarIcon;
  matchPrefixes?: string[];
  external?: boolean;
};

export type SidebarUser = {
  avatarUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  name?: string | null;
  title?: string | null;
  role?: string | null;
};

export type ResolvedSidebarUserIdentity = {
  avatarUrl?: string;
  name: string;
  title: string;
  initials: string;
};

export type SidebarBrand = {
  appName: string;
  eyebrow?: string;
  tagline?: string;
  homeHref?: string;
  logoIcon?: SidebarIcon;
};
