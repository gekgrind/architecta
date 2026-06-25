import "server-only";

import { linkedinAdapter } from "./adapters/linkedin";
import { facebookAdapter, instagramAdapter } from "./adapters/stub";
import type { PlatformId, PublishAdapter } from "./adapters/types";

const ADAPTERS: Record<PlatformId, PublishAdapter> = {
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
  facebook: facebookAdapter,
};

export const SUPPORTED_PLATFORMS = Object.keys(ADAPTERS) as PlatformId[];

export function isPlatformId(value: string): value is PlatformId {
  return value in ADAPTERS;
}

export function getAdapter(platform: PlatformId): PublishAdapter {
  return ADAPTERS[platform];
}

/** Adapters that can actually post today (vs. OAuth-shaped stubs). */
export function listConnectablePlatforms() {
  return SUPPORTED_PLATFORMS.map((p) => ({
    platform: p,
    implemented: ADAPTERS[p].implemented,
  }));
}
