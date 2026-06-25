import "server-only";

export type PlatformId = "linkedin" | "instagram" | "facebook" | "threads";

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
  exchangeCode(args: { code: string; redirectUri: string }): Promise<OAuthTokens>;
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
