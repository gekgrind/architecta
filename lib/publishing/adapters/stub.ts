import "server-only";

import {
  PublishConfigError,
  PublishNotImplementedError,
  type AccountIdentity,
  type OAuthTokens,
  type PlatformId,
  type PublishAdapter,
} from "./types";

/**
 * Stub adapter for platforms whose OAuth + content-publishing requires a
 * developer app + review that isn't wired yet (Instagram, Facebook). It carries
 * the correct interface and known scopes so the UI and registry behave, but
 * every network operation throws a clear, user-facing error until the real
 * adapter is implemented.
 */
export function makeStubAdapter(
  platform: PlatformId,
  scopes: string[]
): PublishAdapter {
  const notReady = () => {
    throw new PublishNotImplementedError(platform);
  };
  return {
    platform,
    scopes,
    implemented: false,
    buildAuthUrl() {
      throw new PublishConfigError(
        `${platform} connections are not available yet`
      );
    },
    async exchangeCode(): Promise<OAuthTokens> {
      return notReady();
    },
    async getAccountIdentity(): Promise<AccountIdentity> {
      return notReady();
    },
    async publish() {
      return notReady();
    },
  };
}

export const instagramAdapter = makeStubAdapter("instagram", [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
]);

export const facebookAdapter = makeStubAdapter("facebook", [
  "pages_manage_posts",
  "pages_read_engagement",
]);
