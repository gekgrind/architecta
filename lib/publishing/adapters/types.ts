import "server-only";

export type PlatformId =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "threads"
  | "x"
  | "pinterest"
  | "youtube"
  | "tiktok";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
  /** ISO timestamp, when known. */
  expiresAt?: string | null;
  scopes: string[];
};

export type AccountIdentity = {
  externalAccountId: string;
  externalAccountName: string | null;
};

export type PublishContext = {
  accessToken: string;
  externalAccountId: string;
  /** Ready-to-post text (the route assembles this from the post fields). */
  text: string;
  /** Signed URL to an image to attach, if any. */
  imageUrl?: string | null;
  /** Signed URL to a video to attach, if any (required by video-only platforms). */
  videoUrl?: string | null;
};

export type PublishResult = {
  externalPostId: string;
  externalUrl: string | null;
};

export type PublishAdapter = {
  platform: PlatformId;
  scopes: string[];
  /** False for stub adapters that can OAuth-shape but not yet post. */
  implemented: boolean;
  buildAuthUrl(args: { state: string; redirectUri: string }): string;
  /** `state` is the same value round-tripped from buildAuthUrl — PKCE adapters re-derive their verifier from it. */
  exchangeCode(args: { code: string; redirectUri: string; state: string }): Promise<OAuthTokens>;
  getAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity>;
  publish(ctx: PublishContext): Promise<PublishResult>;
};

export class PublishNotImplementedError extends Error {
  constructor(platform: string) {
    super(`Publishing to ${platform} is not implemented yet`);
    this.name = "PublishNotImplementedError";
  }
}

export class PublishConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishConfigError";
  }
}

/** The platform rejected the access token (invalid, expired or revoked): the user must reconnect. */
export class PublishAuthError extends Error {
  constructor(platform: string, detail?: string) {
    super(`${platform} rejected the access token${detail ? `: ${detail}` : ""}`);
    this.name = "PublishAuthError";
  }
}

/** A non-auth HTTP failure from the platform, carrying the status for retry classification. */
export class PublishHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PublishHttpError";
  }
}
