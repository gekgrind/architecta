import "server-only";

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
 * The user's own self-hosted WordPress site, over the core REST API.
 *
 * Auth is a WordPress *Application Password* (Users → Profile → Application
 * Passwords) sent as HTTP Basic — never the user's real account password.
 * Because that credential rides on every request, https is required.
 */

const API = "/wp-json/wp/v2";

// Application passwords are shown grouped ("abcd EFGH ijkl") and WordPress
// strips the spaces itself; do the same so a pasted value just works.
function normalizeAppPassword(raw: string): string {
  return raw.replace(/\s+/g, "");
}

export function normalizeSiteUrl(raw: string): string {
  const url = normalizePublicHttpsUrl(raw, {
    invalid: "Enter the full site URL, including https:// — for example https://example.com",
    insecure:
      "The site URL must use https:// — your application password is sent with every request.",
    private: "That host isn't a reachable public WordPress site.",
  });
  // Keep the path: WordPress is often installed in a subdirectory (/blog).
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function siteFrom(credentials: DestinationCredentials): string {
  const site = credentials.config.siteUrl;
  if (!site) throw new DestinationConfigError("Connection is missing its site URL");
  return normalizeSiteUrl(site);
}

function authHeader(credentials: DestinationCredentials): string {
  const username = credentials.config.username;
  if (!username) throw new DestinationConfigError("Connection is missing its username");
  const pair = `${username}:${normalizeAppPassword(credentials.secret)}`;
  return `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

/** WordPress errors come back as { code, message, data: { status } }. */
async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { message?: string };
    return json.message ? stripTags(json.message) : "";
  } catch {
    return "";
  }
}

async function wpRequest<T>(args: {
  site: string;
  credentials: DestinationCredentials;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<T> {
  const { site, credentials, path, method = "GET", body } = args;
  const res = await fetch(`${site}${API}${path}`, {
    method,
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        detail || "WordPress rejected the username or application password"
      );
    }
    if (res.status === 404) {
      throw new Error(
        detail ||
          "WordPress REST API not found at that URL — check the site address and that the REST API is enabled"
      );
    }
    throw new Error(`WordPress request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

type WpTerm = { id: number; name: string; slug: string };

/**
 * Resolve category/tag names to the numeric ids the REST API requires.
 * Missing *tags* are created (they're freeform, and that's what every
 * WordPress client does); missing *categories* are never created — they're
 * curated site structure — and come back in `skipped` instead.
 */
async function resolveTerms(args: {
  site: string;
  credentials: DestinationCredentials;
  taxonomy: "categories" | "tags";
  names: string[];
}): Promise<{ ids: number[]; skipped: string[] }> {
  const { site, credentials, taxonomy, names } = args;
  const ids: number[] = [];
  const skipped: string[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;

    // Callers may pass ids straight through.
    if (/^\d+$/.test(name)) {
      ids.push(Number(name));
      continue;
    }

    let matches: WpTerm[] = [];
    try {
      matches = await wpRequest<WpTerm[]>({
        site,
        credentials,
        path: `/${taxonomy}?search=${encodeURIComponent(name)}&per_page=20`,
      });
    } catch {
      skipped.push(name);
      continue;
    }

    const lowered = name.toLowerCase();
    const hit = matches.find(
      (t) => t.name.toLowerCase() === lowered || t.slug.toLowerCase() === lowered
    );
    if (hit) {
      ids.push(hit.id);
      continue;
    }

    if (taxonomy === "categories") {
      skipped.push(name);
      continue;
    }

    try {
      const created = await wpRequest<WpTerm>({
        site,
        credentials,
        path: `/${taxonomy}`,
        method: "POST",
        body: { name },
      });
      ids.push(created.id);
    } catch {
      skipped.push(name);
    }
  }

  return { ids, skipped };
}

function filenameFor(imageUrl: string, contentType: string): string {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";
  let base = "featured-image";
  try {
    const fromPath = new URL(imageUrl).pathname.split("/").pop();
    if (fromPath) base = fromPath.replace(/\.[^.]+$/, "").slice(0, 60) || base;
  } catch {
    // Keep the default.
  }
  return `${base.replace(/[^a-z0-9._-]/gi, "-")}.${ext}`;
}

/** Upload an image into the site's media library and return its attachment id. */
async function uploadFeaturedImage(args: {
  site: string;
  credentials: DestinationCredentials;
  imageUrl: string;
}): Promise<number> {
  const { site, credentials, imageUrl } = args;

  const assetRes = await fetch(imageUrl);
  if (!assetRes.ok) {
    throw new Error(`Could not fetch the featured image (${assetRes.status})`);
  }
  const contentType = assetRes.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await assetRes.arrayBuffer());

  const res = await fetch(`${site}${API}/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filenameFor(imageUrl, contentType)}"`,
    },
    body: bytes,
  });
  if (!res.ok) {
    const detail = await readError(res);
    throw new Error(`WordPress media upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const json = (await res.json()) as { id?: number };
  if (!json.id) throw new Error("WordPress media upload returned no attachment id");
  return json.id;
}

type WpPost = {
  id: number;
  link?: string;
  status?: string;
  slug?: string;
};

/** Assemble the POST /posts body shared by draft, publish and schedule. */
async function buildPostBody(
  ctx: DraftContext,
  status: "draft" | "publish" | "future"
): Promise<{ body: Record<string, unknown>; skippedCategories: string[] }> {
  const site = siteFrom(ctx.credentials);
  const { content } = ctx;

  const body: Record<string, unknown> = {
    title: content.title,
    content: content.html,
    status,
  };
  if (content.slug) body.slug = content.slug;

  let skippedCategories: string[] = [];
  if (content.categories?.length) {
    const resolved = await resolveTerms({
      site,
      credentials: ctx.credentials,
      taxonomy: "categories",
      names: content.categories,
    });
    if (resolved.ids.length) body.categories = resolved.ids;
    skippedCategories = resolved.skipped;
  }
  if (content.tags?.length) {
    const resolved = await resolveTerms({
      site,
      credentials: ctx.credentials,
      taxonomy: "tags",
      names: content.tags,
    });
    if (resolved.ids.length) body.tags = resolved.ids;
  }

  if (content.featuredImageUrl) {
    try {
      body.featured_media = await uploadFeaturedImage({
        site,
        credentials: ctx.credentials,
        imageUrl: content.featuredImageUrl,
      });
    } catch {
      // Best-effort, exactly like the social adapters: a missing featured
      // image must not cost the user the whole draft.
    }
  }

  return { body, skippedCategories };
}

/** WordPress wants a naive ISO datetime (no zone designator) for date_gmt. */
function toGmtStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    throw new DestinationConfigError("Invalid scheduled time");
  }
  return at.toISOString().replace(/\.\d{3}Z$/, "");
}

export const wordpressAdapter: ContentDestinationAdapter = {
  destination: "wordpress",
  kind: "cms",
  connectMethod: "credentials",
  scopes: [],
  implemented: true,

  async connect(input: DestinationConnectInput): Promise<DestinationConnection> {
    if (input.method !== "credentials") {
      throw new DestinationConfigError("WordPress connects with a site URL and application password");
    }
    const siteUrl = normalizeSiteUrl(input.values.siteUrl ?? "");
    const username = (input.values.username ?? "").trim();
    const applicationPassword = normalizeAppPassword(input.values.applicationPassword ?? "");
    if (!username || !applicationPassword) {
      throw new DestinationConfigError("Username and application password are both required");
    }

    const credentials: DestinationCredentials = {
      secret: applicationPassword,
      refreshSecret: null,
      config: { siteUrl, username },
    };

    const me = await wpRequest<{
      id?: number;
      name?: string;
      capabilities?: Record<string, boolean>;
    }>({ site: siteUrl, credentials, path: "/users/me?context=edit" });

    if (!me.id) {
      throw new Error("WordPress did not return an account for those credentials");
    }
    if (me.capabilities && me.capabilities.edit_posts === false) {
      throw new Error(`${me.name ?? username} can't create posts on that site`);
    }

    return {
      identity: {
        externalAccountId: String(me.id),
        externalAccountName: me.name ?? username,
      },
      credentials,
      scopes: [],
      expiresAt: null,
    };
  },

  async validateConnection(session: DestinationSession): Promise<ConnectionCheck> {
    try {
      const site = siteFrom(session.credentials);
      const me = await wpRequest<{ id?: number; name?: string }>({
        site,
        credentials: session.credentials,
        path: "/users/me?context=edit",
      });
      if (!me.id) {
        return { ok: false, detail: "WordPress did not recognise the stored credentials" };
      }
      return {
        ok: true,
        detail: `Connected to ${new URL(site).host} as ${me.name ?? session.credentials.config.username}`,
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
    const { body } = await buildPostBody(ctx, "draft");

    const created = await wpRequest<WpPost>({
      site,
      credentials: ctx.credentials,
      path: "/posts",
      method: "POST",
      body,
    });

    return {
      externalId: String(created.id),
      externalUrl: created.link ?? null,
      status: "draft",
    };
  },

  async publish(ctx: PublishDestinationContext): Promise<DestinationPublishResult> {
    const site = siteFrom(ctx.credentials);

    // Promote an existing draft when we have one; otherwise create it live.
    const post = ctx.externalId
      ? await wpRequest<WpPost>({
          site,
          credentials: ctx.credentials,
          path: `/posts/${encodeURIComponent(ctx.externalId)}`,
          method: "POST",
          body: { status: "publish" },
        })
      : await wpRequest<WpPost>({
          site,
          credentials: ctx.credentials,
          path: "/posts",
          method: "POST",
          body: (await buildPostBody(ctx, "publish")).body,
        });

    return {
      externalId: String(post.id),
      externalUrl: post.link ?? null,
      status: "published",
    };
  },

  async schedule(ctx: ScheduleDestinationContext): Promise<DestinationPublishResult> {
    const site = siteFrom(ctx.credentials);
    const dateGmt = toGmtStamp(ctx.scheduledFor);

    const post = ctx.externalId
      ? await wpRequest<WpPost>({
          site,
          credentials: ctx.credentials,
          path: `/posts/${encodeURIComponent(ctx.externalId)}`,
          method: "POST",
          body: { status: "future", date_gmt: dateGmt },
        })
      : await wpRequest<WpPost>({
          site,
          credentials: ctx.credentials,
          path: "/posts",
          method: "POST",
          body: { ...(await buildPostBody(ctx, "future")).body, date_gmt: dateGmt },
        });

    return {
      externalId: String(post.id),
      externalUrl: post.link ?? null,
      status: "scheduled",
    };
  },

  async disconnect(): Promise<void> {
    // Application passwords are revoked by the user in WordPress admin
    // (Users → Profile → Application Passwords). Nothing to call remotely;
    // the stored row is deleted by the caller.
  },
};
