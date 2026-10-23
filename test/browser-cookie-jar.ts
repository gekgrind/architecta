import { expect } from "vitest";

export const ARCHITECTA_HOST = "architecta.entrepreneuria.io";
export const SHARED_DOMAIN = "entrepreneuria.io";

export type Scope = "host-only" | "shared-domain";

type StoredCookie = {
  name: string;
  value: string;
  /** Host a host-only cookie is bound to; null for a Domain cookie. */
  host: string | null;
  /** Domain a Domain cookie is scoped to, without the leading dot. */
  domain: string | null;
  path: string;
  expiresAt: number;
  created: number;
};

/**
 * Browser cookie jar, just faithful enough for scope migration: cookies
 * are keyed by name + Domain/host + Path (RFC 6265 §5.3), so a host-only
 * and a `.entrepreneuria.io` cookie of one name coexist and a deletion
 * removes only the scope and path it names. A host-only cookie is sent
 * only to the host that set it — architecta.entrepreneuria.io's never
 * reach entrepreneuria.io — and a Domain cookie to that domain and its
 * subdomains. The Cookie header orders longer paths first, then older
 * cookies first, and an overwrite keeps the original creation time.
 */
export class BrowserCookieJar {
  private cookies = new Map<string, StoredCookie>();
  private clock = 0;

  constructor(private readonly host = ARCHITECTA_HOST) {}

  private key(name: string, host: string | null, domain: string | null, path: string) {
    return `${name}|${domain ? `.${domain}` : host}|${path}`;
  }

  private store(cookie: Omit<StoredCookie, "created">) {
    const key = this.key(cookie.name, cookie.host, cookie.domain, cookie.path);
    const existing = this.cookies.get(key);

    if (cookie.expiresAt <= Date.now()) {
      this.cookies.delete(key);
    } else {
      this.cookies.set(key, {
        ...cookie,
        created: existing?.created ?? (this.clock += 1),
      });
    }
  }

  apply(response: Response, requestHost = this.host) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";").map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = decodeURIComponent(pair.slice(separator + 1));
      let domain: string | null = null;
      let path = "/";
      let expiresAt = Infinity;

      for (const attribute of attributes) {
        const [attrName, attrValue = ""] = attribute.split("=");
        const lower = attrName.toLowerCase();

        if (lower === "domain") {
          domain = attrValue.replace(/^\./, "").toLowerCase();
          /* A browser rejects a Domain this host is not inside. */
          expect(
            requestHost === domain || requestHost.endsWith(`.${domain}`),
            `Set-Cookie from ${requestHost} for foreign domain ${domain}`
          ).toBe(true);
        } else if (lower === "path") {
          path = attrValue || "/";
        } else if (lower === "max-age") {
          expiresAt = Math.min(expiresAt, Date.now() + Number(attrValue) * 1000);
        } else if (lower === "expires" && expiresAt === Infinity) {
          expiresAt = new Date(attrValue).getTime();
        }
      }

      this.store({
        name,
        value,
        host: domain ? null : requestHost,
        domain,
        path,
        expiresAt,
      });
    }
  }

  set(
    name: string,
    value: string,
    scope: Scope,
    { path = "/", host = this.host }: { path?: string; host?: string } = {}
  ) {
    this.store({
      name,
      value,
      host: scope === "host-only" ? host : null,
      domain: scope === "host-only" ? null : SHARED_DOMAIN,
      path,
      expiresAt: Infinity,
    });
  }

  get(name: string, scope: Scope, { path = "/", host = this.host } = {}) {
    return this.cookies.get(
      scope === "host-only"
        ? this.key(name, host, null, path)
        : this.key(name, null, SHARED_DOMAIN, path)
    )?.value;
  }

  /** The Cookie header this browser sends to `host` for `pathname`. */
  header(pathname = "/", host = this.host) {
    const now = Date.now();

    return Array.from(this.cookies.values())
      .filter(
        (cookie) =>
          cookie.expiresAt > now &&
          (cookie.domain
            ? host === cookie.domain || host.endsWith(`.${cookie.domain}`)
            : cookie.host === host) &&
          (cookie.path === "/" ||
            pathname === cookie.path ||
            pathname.startsWith(`${cookie.path.replace(/\/$/, "")}/`))
      )
      .sort((a, b) => b.path.length - a.path.length || a.created - b.created)
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
  }

  names(scope: Scope, prefix = "", host = this.host) {
    return Array.from(this.cookies.values())
      .filter(
        (cookie) =>
          cookie.name.startsWith(prefix) &&
          (scope === "host-only"
            ? cookie.host === host
            : cookie.domain === SHARED_DOMAIN)
      )
      .map((cookie) => cookie.name)
      .sort();
  }

  get size() {
    return this.cookies.size;
  }
}
