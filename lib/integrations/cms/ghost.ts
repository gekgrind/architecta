import "server-only";

import { createHmac } from "node:crypto";

import {
  DestinationConfigError,
  type ConnectionCheck,
  type ContentDestinationAdapter,
  type DestinationConnectInput,
  type DestinationConnection,
  type DestinationCredentials,
  type DestinationPublishResult,
  type DestinationSession,
  type DraftContext,
  type DraftResult,
  type PublishDestinationContext,
  type ScheduleDestinationContext,
} from "../types";
import { normalizePublicHttpsUrl } from "../url";

/**
 * The user's own Ghost blog, over the Ghost Admin API.
 *
 * Auth is an *Admin API key* (Ghost admin → Settings → Integrations → Add
 * custom integration), which arrives as `id:secret`. The secret is never sent:
 * each request carries a short-lived HS256 JWT signed with it, which is how
 * Ghost's Admin API is designed to be called.
 */

const ADMIN_API = "/ghost/api/admin";
// Ghost negotiates behaviour from this header; v5 is the current major.
const ACCEPT_VERSION = "v5.0";
/** Ghost rejects tokens older than 5 minutes; mint one per request. */
const TOKEN_TTL_SECONDS = 300;

export function normalizeGhostUrl(raw: string): string {
  const url = normalizePublicHttpsUrl(raw, {
    invalid: "Enter the full site URL, including https:// — for example https://example.com",
    insecure: "The site URL must use https:// — your Admin API key is sent with every request.",
    private: "That host isn't a reachable public Ghost site.",
  });
  // Keep the path: Ghost is often served from a subdirectory (/blog).
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input as never)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Split the `id:secret` Admin API key. Ghost ids are 24 hex chars and secrets
 * 64, so a Content API key (a bare 26-char string) fails here with a message
 * that says which key to use — that mix-up is the usual setup mistake.
 */
export function parseAdminApiKey(raw: string): { id: string; secret: string } {
  const value = raw.trim();
  const [id, secret] = value.split(":");
  if (!id || !secret || !/^[0-9a-f]+$/i.test(id) || !/^[0-9a-f]+$/i.test(secret)) {
    throw new DestinationConfigError(
      "That doesn't look like a Ghost Admin API key. It has the form id:secret — copy it from Settings → Integrations, not the Content API key."
    );
  }
  return { id, secret };
}

/** Mint the short-lived HS256 token Ghost's Admin API expects. */
export function buildGhostToken(adminApiKey: string): string {
  const { id, secret } = parseAdminApiKey(adminApiKey);
  const iat = Math.floor(Date.now() / 1000);

  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const payload = base64Url(
    JSON.stringify({ iat, exp: iat + TOKEN_TTL_SECONDS, aud: ADMIN_API + "/" })
  );
  const signature = base64Url(
    createHmac("sha256", Buffer.from(secret, "hex"))
      .update(`${header}.${payload}`)
      .digest()
  );
  return `${header}.${payload}.${signature}`;
}

function siteFrom(credentials: DestinationCredentials): string {
  const site = credentials.config.siteUrl;
  if (!site) throw new DestinationConfigError("Connection is missing its site URL");
  return normalizeGhostUrl(site);
}

/** Ghost errors come back as { errors: [{ message, context }] }. */
async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as {
      errors?: Array<{ message?: string; context?: string }>;
    };
    const first = json.errors?.[0];
    return [first?.message, first?.context].filter(Boolean).join(" — ");
  } catch {
    return "";
  }
}

async function ghostRequest<T>(args: {
  site: string;
  adminApiKey: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<T> {
  const { site, adminApiKey, path, method = "GET", body } = args;

  const res = await fetch(`${site}${ADMIN_API}${path}`, {
    method,
    headers: {
      Authorization: `Ghost ${buildGhostToken(adminApiKey)}`,
      "Accept-Version": ACCEPT_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401 || res.status === 403) {
      throw new Error(detail || "Ghost rejected the Admin API key");
    }
    if (res.status === 404) {
      throw new Error(
        detail ||
          "Ghost Admin API not found at that URL — check the site address and that it's a Ghost site"
      );
    }
    throw new Error(`Ghost request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

type GhostPost = {
  id?: string;
  url?: string;
  status?: string;
  updated_at?: string;
};

type GhostPostsResponse = { posts?: GhostPost[] };

function filenameFor(imageUrl: string, contentType: string): string {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";
  let base = "feature-image";
  try {
    const fromPath = new URL(imageUrl).pathname.split("/").pop();
    if (fromPath) base = fromPath.replace(/\.[^.]+$/, "").slice(0, 60) || base;
  } catch {
    // Keep the default.
  }
  return `${base.replace(/[^a-z0-9._-]/gi, "-")}.${ext}`;
}

/**
 * Upload an image into the site's own media store and return its Ghost URL.
 * The generated-asset URL we receive is a short-lived signed link, so pointing
 * `feature_image` straight at it would break as soon as it expired.
 */
async function uploadFeatureImage(args: {
  site: string;
  adminApiKey: string;
  imageUrl: string;
}): Promise<string> {
  const { site, adminApiKey, imageUrl } = args;

  const assetRes = await fetch(imageUrl);
  if (!assetRes.ok) {
    throw new Error(`Could not fetch the feature image (${assetRes.status})`);
  }
  const contentType = assetRes.headers.get("content-type") ?? "image/jpeg";
  const bytes = await assetRes.arrayBuffer();

  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: contentType }),
    filenameFor(imageUrl, contentType)
  );
  form.append("purpose", "image");

  const res = await fetch(`${site}${ADMIN_API}/images/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Ghost ${buildGhostToken(adminApiKey)}`,
      "Accept-Version": ACCEPT_VERSION,
      // Content-Type is intentionally unset: fetch adds the multipart boundary.
    },
    body: form,
  });
  if (!res.ok) {
    const detail = await readError(res);
    throw new Error(`Ghost image upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const json = (await res.json()) as { images?: Array<{ url?: string }> };
  const url = json.images?.[0]?.url;
  if (!url) throw new Error("Ghost image upload returned no URL");
  return url;
}

/** Assemble the post body shared by draft, publish and schedule. */
async function buildPostBody(
  ctx: DraftContext,
  status: "draft" | "published" | "scheduled"
): Promise<Record<string, unknown>> {
  const site = siteFrom(ctx.credentials);
  const { content } = ctx;

  const post: Record<string, unknown> = {
    title: content.title,
    html: content.html,
    status,
  };
  if (content.slug) post.slug = content.slug;

  // Ghost has one taxonomy: tags. Categories from the generator map onto it
  // rather than being dropped — Ghost creates any tag that doesn't exist yet.
  const tagNames = Array.from(
    new Set(
      [...(content.categories ?? []), ...(content.tags ?? [])]
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
  if (tagNames.length) post.tags = tagNames.map((name) => ({ name }));

  if (content.featuredImageUrl) {
    try {
      post.feature_image = await uploadFeatureImage({
        site,
        adminApiKey: ctx.credentials.secret,
        imageUrl: content.featuredImageUrl,
      });
    } catch {
      // Best-effort, exactly like the WordPress adapter: a missing feature
      // image must not cost the user the whole draft.
    }
  }

  return post;
}

/**
 * Ghost uses `updated_at` for collision detection: every update must echo the
 * value the server currently holds, so read it immediately before writing.
 */
async function currentUpdatedAt(args: {
  site: string;
  adminApiKey: string;
  postId: string;
}): Promise<string> {
  const { site, adminApiKey, postId } = args;
  const res = await ghostRequest<GhostPostsResponse>({
    site,
    adminApiKey,
    path: `/posts/${encodeURIComponent(postId)}/?fields=id,updated_at`,
  });
  const updatedAt = res.posts?.[0]?.updated_at;
  if (!updatedAt) throw new Error("Ghost could not find that draft any more");
  return updatedAt;
}

function firstPost(res: GhostPostsResponse): GhostPost {
  const post = res.posts?.[0];
  if (!post?.id) throw new Error("Ghost did not return a post");
  return post;
}

export const ghostAdapter: ContentDestinationAdapter = {
  destination: "ghost",
  kind: "cms",
  connectMethod: "credentials",
  scopes: [],
  implemented: true,

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "credentials") {
      throw new DestinationConfigError(
        "Ghost connects with a site URL and Admin API key"
      );
    }
    const siteUrl = normalizeGhostUrl(input.values.siteUrl ?? "");
    const adminApiKey = (input.values.adminApiKey ?? "").trim();
    if (!adminApiKey) {
      throw new DestinationConfigError("The Admin API key is required");
    }
    // Fail on a malformed key here rather than as a confusing 401 later.
    parseAdminApiKey(adminApiKey);

    const me = await ghostRequest<{
      users?: Array<{ id?: string; name?: string; email?: string }>;
    }>({ site: siteUrl, adminApiKey, path: "/users/me/" });

    const user = me.users?.[0];
    if (!user?.id) {
      throw new Error("Ghost did not return an account for that Admin API key");
    }

    return {
      identity: {
        externalAccountId: user.id,
        externalAccountName: user.name ?? user.email ?? "Ghost",
      },
      credentials: {
        secret: adminApiKey,
        refreshSecret: null,
        config: { siteUrl },
      },
      scopes: [],
      expiresAt: null,
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      const site = siteFrom(session.credentials);
      const me = await ghostRequest<{
        users?: Array<{ id?: string; name?: string; email?: string }>;
      }>({ site, adminApiKey: session.credentials.secret, path: "/users/me/" });

      const user = me.users?.[0];
      if (!user?.id) {
        return { ok: false, detail: "Ghost did not recognise the stored Admin API key" };
      }
      return {
        ok: true,
        detail: `Connected to ${new URL(site).host} as ${user.name ?? user.email}`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : "Could not reach the site",
      };
    }
  },

  async createDraft(ctx: DraftContext): Promise<DraftResult> {
    const site = siteFrom(ctx.credentials);
    const created = await ghostRequest<GhostPostsResponse>({
      site,
      adminApiKey: ctx.credentials.secret,
      // `source=html` tells Ghost to convert our HTML into its own Lexical
      // format; without it the `html` field is ignored entirely.
      path: "/posts/?source=html",
      method: "POST",
      body: { posts: [await buildPostBody(ctx, "draft")] },
    });

    const post = firstPost(created);
    return {
      externalId: post.id!,
      externalUrl: post.url ?? null,
      status: "draft",
    };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    const site = siteFrom(ctx.credentials);
    const adminApiKey = ctx.credentials.secret;

    // Promote an existing draft when we have one; otherwise create it live.
    const res = ctx.externalId
      ? await ghostRequest<GhostPostsResponse>({
          site,
          adminApiKey,
          path: `/posts/${encodeURIComponent(ctx.externalId)}/?source=html`,
          method: "PUT",
          body: {
            posts: [
              {
                status: "published",
                updated_at: await currentUpdatedAt({
                  site,
                  adminApiKey,
                  postId: ctx.externalId,
                }),
              },
            ],
          },
        })
      : await ghostRequest<GhostPostsResponse>({
          site,
          adminApiKey,
          path: "/posts/?source=html",
          method: "POST",
          body: { posts: [await buildPostBody(ctx, "published")] },
        });

    const post = firstPost(res);
    return {
      externalId: post.id!,
      externalUrl: post.url ?? null,
      status: "published",
    };
  },

  async schedule(ctx: ScheduleDestinationContext): Promise<DestinationPublishResult> {
    const site = siteFrom(ctx.credentials);
    const adminApiKey = ctx.credentials.secret;
    const at = new Date(ctx.scheduledFor);
    if (Number.isNaN(at.getTime())) {
      throw new DestinationConfigError("Invalid scheduled time");
    }
    const publishedAt = at.toISOString();

    const res = ctx.externalId
      ? await ghostRequest<GhostPostsResponse>({
          site,
          adminApiKey,
          path: `/posts/${encodeURIComponent(ctx.externalId)}/?source=html`,
          method: "PUT",
          body: {
            posts: [
              {
                status: "scheduled",
                published_at: publishedAt,
                updated_at: await currentUpdatedAt({
                  site,
                  adminApiKey,
                  postId: ctx.externalId,
                }),
              },
            ],
          },
        })
      : await ghostRequest<GhostPostsResponse>({
          site,
          adminApiKey,
          path: "/posts/?source=html",
          method: "POST",
          body: {
            posts: [
              { ...(await buildPostBody(ctx, "scheduled")), published_at: publishedAt },
            ],
          },
        });

    const post = firstPost(res);
    return {
      externalId: post.id!,
      externalUrl: post.url ?? null,
      status: "scheduled",
    };
  },

  async disconnect(): Promise<void> {
    // Admin API keys are revoked by the user in Ghost admin (Settings →
    // Integrations). Nothing to call remotely; the stored row is deleted by
    // the caller.
  },
};
