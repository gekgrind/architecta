import "server-only";

/**
 * Content destinations are the user's *own* accounts that Architecta hands
 * finished content to: their WordPress site, their Gmail mailbox, their Brevo
 * account. Architecta hosts no blog and sends no bulk mail itself.
 *
 * This mirrors the social `PublishAdapter` in lib/publishing, but the shape
 * differs on purpose: destinations are draft-first (create something the user
 * can review in the destination's own UI) and only publish or send on a
 * separate, explicit, user-triggered action.
 */

export type DestinationId =
  | "wordpress"
  | "ghost"
  | "custom"
  | "gmail"
  | "microsoft"
  | "brevo";

export type DestinationKind = "cms" | "email";

/** How the user hands us credentials: a form, or a provider OAuth round-trip. */
export type ConnectMethod = "credentials" | "oauth";

/** Decrypted secret material. Server-only — never serialize this to a client. */
export type DestinationCredentials = {
  /** Primary secret: WordPress application password, API key, or access token. */
  secret: string;
  /** OAuth refresh token, for providers that issue one. */
  refreshSecret?: string | null;
  /** ISO timestamp the access token expires, for providers that expire them. */
  expiresAt?: string | null;
  /** Non-secret connection config (site URL, username, sender address, …). */
  config: Record<string, string>;
};

/** A credential an adapter refreshed mid-call, for the caller to persist. */
export type RefreshedCredentials = {
  secret: string;
  refreshSecret?: string | null;
  expiresAt?: string | null;
};

export type DestinationIdentity = {
  externalAccountId: string;
  externalAccountName: string | null;
};

export type DestinationConnectInput =
  | { method: "credentials"; values: Record<string, string> }
  | { method: "oauth"; code: string; state: string; redirectUri: string };

export type DestinationConnection = {
  identity: DestinationIdentity;
  credentials: DestinationCredentials;
  scopes: string[];
  /** ISO timestamp, when the provider expires the credential. */
  expiresAt?: string | null;
};

export type ConnectionCheck = {
  ok: boolean;
  /** Human-readable detail for the settings UI — never includes secrets. */
  detail: string;
};

/** An established connection, as every adapter method receives it. */
export type DestinationSession = {
  credentials: DestinationCredentials;
  identity: DestinationIdentity;
  /**
   * Called when an adapter refreshes an expiring OAuth credential, so the
   * caller can persist it. Optional — adapters must still work without it.
   */
  onCredentialsRefreshed?: (next: RefreshedCredentials) => Promise<void>;
};

/** Content handed to a destination; the caller assembles it from a post row. */
export type DestinationContent = {
  title: string;
  /** HTML body for a WordPress post or Brevo campaign. */
  html: string;
  /** Plain-text alternative, when the caller has one. */
  text?: string | null;
  slug?: string | null;
  /** Term names or numeric ids — adapters resolve names against the site. */
  categories?: string[];
  tags?: string[];
  /** Image URL the adapter fetches and re-uploads as the featured image. */
  featuredImageUrl?: string | null;
  /** Email only: subject line. Falls back to `title`. */
  subject?: string | null;
  /** Email only: recipient address (Gmail) or existing list id (Brevo). */
  audience?: string | null;
};

export type DraftContext = DestinationSession & {
  content: DestinationContent;
};

export type DraftResult = {
  externalId: string;
  externalUrl: string | null;
  status: "draft";
};

/** Promoting a draft the adapter already created, or creating one outright. */
export type PublishDestinationContext = DraftContext & {
  externalId?: string | null;
};

export type ScheduleDestinationContext = PublishDestinationContext & {
  /** ISO timestamp for the scheduled publish/send. */
  scheduledFor: string;
};

export type DestinationPublishResult = {
  externalId: string;
  externalUrl: string | null;
  status: "published" | "sent" | "scheduled";
};

export type ContentDestinationAdapter = {
  destination: DestinationId;
  kind: DestinationKind;
  connectMethod: ConnectMethod;
  /** OAuth scopes requested; empty for credential-based destinations. */
  scopes: string[];
  /** False for adapters that are wired but not live yet. */
  implemented: boolean;

  /** Validate the supplied credentials and resolve the account identity. */
  connect(input: DestinationConnectInput): Promise<DestinationConnection>;
  /** Re-check a stored connection — powers the settings "Test" button. */
  validateConnection(session: DestinationSession): Promise<ConnectionCheck>;
  /** Create something the user reviews in the destination's own UI. */
  createDraft(ctx: DraftContext): Promise<DraftResult>;
  /** Go live. Only ever called from an explicit, user-triggered approval. */
  publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult>;
  /** Queue for a future time. Also approval-gated. */
  schedule(ctx: ScheduleDestinationContext): Promise<DestinationPublishResult>;
  /** Revoke remotely where the provider supports it; local row is deleted either way. */
  disconnect(session: DestinationSession): Promise<void>;
  /** OAuth destinations only — builds the provider's authorize URL. */
  buildAuthUrl?(args: { state: string; redirectUri: string }): string;
};

export class DestinationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationConfigError";
  }
}

export class DestinationNotImplementedError extends Error {
  constructor(destination: string) {
    super(`${destination} is not available yet`);
    this.name = "DestinationNotImplementedError";
  }
}

/** Thrown when an adapter is asked to do something its connection can't support. */
export class DestinationUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationUnsupportedError";
  }
}
