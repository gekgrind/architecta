import "server-only";

import { facebookAdapter } from "./adapters/facebook";
import { instagramAdapter } from "./adapters/instagram";
import { linkedinAdapter } from "./adapters/linkedin";
import { pinterestAdapter } from "./adapters/pinterest";
import { threadsAdapter } from "./adapters/threads";
import { tiktokAdapter } from "./adapters/tiktok";
import type { PlatformId, PublishAdapter } from "./adapters/types";
import { xAdapter } from "./adapters/x";
import { youtubeAdapter } from "./adapters/youtube";

const ADAPTERS: Record<PlatformId, PublishAdapter> = {
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  threads: threadsAdapter,
  x: xAdapter,
  pinterest: pinterestAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
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
