import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GMAIL_SCOPES,
  buildMimeMessage,
  gmailAdapter,
  parseRecipients,
} from "./gmail";
import type { DestinationSession } from "../types";

const REDIRECT = "https://architecta.example/api/integrations/gmail/callback";

function sessionWith(overrides: Partial<DestinationSession["credentials"]> = {}) {
  return {
    credentials: {
      secret: "access-token",
      refreshSecret: "refresh-token",
      // An hour out, so nothing refreshes unless a test asks for it.
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      config: { email: "founder@example.com", googleUserId: "108374" },
      ...overrides,
    },
    identity: {
      externalAccountId: "108374",
      externalAccountName: "founder@example.com",
    },
  } satisfies DestinationSession;
}

const content = {
  title: "Quick follow-up",
  html: "<p>Hello there</p>",
  subject: "Quick follow-up",
  audience: "a@example.com, b@example.com",
};

type MockCall = { url: string; init: RequestInit };

function stubFetch(routes: Array<{ match: string; status?: number; json: unknown }>) {
  const calls: MockCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const route = routes.find((r) => url.includes(r.match));
      const status = route?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => route?.json ?? {},
        headers: { get: () => null },
      };
    })
  );
  return calls;
}

function bodyOf(call: MockCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body));
}

function decodeRaw(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

beforeEach(() => {
  process.env.GOOGLE_INTEGRATION_CLIENT_ID = "client-123";
  process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = "secret-abc";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("gmail scopes", () => {
  it("requests compose but never any inbox-read scope", () => {
    expect(GMAIL_SCOPES).toContain("https://www.googleapis.com/auth/gmail.compose");
    for (const forbidden of [
      "gmail.readonly",
      "gmail.metadata",
      "gmail.modify",
      "https://mail.google.com/",
    ]) {
      expect(GMAIL_SCOPES.some((s) => s.includes(forbidden))).toBe(false);
    }
  });
});

describe("gmailAdapter.buildAuthUrl", () => {
  it("builds a Google authorize URL that can return a refresh token", () => {
    const url = new URL(
      gmailAdapter.buildAuthUrl!({ state: "gmail.nonce", redirectUri: REDIRECT })
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("gmail.nonce");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("gmail.compose");
  });

  it("throws a config error when Google creds are missing", () => {
    delete process.env.GOOGLE_INTEGRATION_CLIENT_ID;
    expect(() =>
      gmailAdapter.buildAuthUrl!({ state: "s", redirectUri: REDIRECT })
    ).toThrow(/GOOGLE_INTEGRATION_CLIENT_ID/);
  });
});

describe("parseRecipients", () => {
  it("accepts one address and a small group, de-duplicating", () => {
    expect(parseRecipients("a@example.com")).toEqual(["a@example.com"]);
    expect(parseRecipients("a@example.com, b@example.com; a@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("rejects an empty list and malformed addresses", () => {
    expect(() => parseRecipients("")).toThrow(/at least one recipient/i);
    expect(() => parseRecipients("not-an-email")).toThrow(/not a valid email/i);
  });

  it("pushes bulk audiences toward a campaign instead", () => {
    const many = Array.from({ length: 51 }, (_, i) => `u${i}@example.com`).join(",");
    expect(() => parseRecipients(many)).toThrow(/Brevo campaign/i);
  });
});

describe("buildMimeMessage", () => {
  it("writes the envelope headers", () => {
    const mime = buildMimeMessage({
      from: "me@example.com",
      to: ["a@example.com", "b@example.com"],
      subject: "Hi",
      html: "<p>x</p>",
    });
    expect(mime).toContain("From: me@example.com");
    expect(mime).toContain("To: a@example.com, b@example.com");
    expect(mime).toContain("Subject: Hi");
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it("strips CRLF from the subject so headers can't be injected", () => {
    const mime = buildMimeMessage({
      from: "me@example.com",
      to: ["a@example.com"],
      subject: "Hi\r\nBcc: attacker@evil.com",
      html: "<p>x</p>",
    });
    // The payload must survive only as subject text — never as its own header.
    expect(mime.split("\r\n").some((line) => line.startsWith("Bcc:"))).toBe(false);
    expect(mime).toContain("Subject: Hi Bcc: attacker@evil.com");
  });
});

describe("gmailAdapter.connect", () => {
  it("exchanges the code and identifies the mailbox", async () => {
    stubFetch([
      {
        match: "oauth2.googleapis.com/token",
        json: {
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3599,
          scope: "openid email https://www.googleapis.com/auth/gmail.compose",
        },
      },
      {
        match: "openidconnect",
        json: { sub: "108374", email: "founder@example.com" },
      },
    ]);

    const result = await gmailAdapter.connect({
      method: "oauth",
      code: "code-1",
      state: "gmail.nonce",
      redirectUri: REDIRECT,
    });

    // google_user_id (stable subject) and email are stored separately.
    expect(result.identity.externalAccountId).toBe("108374");
    expect(result.identity.externalAccountName).toBe("founder@example.com");
    expect(result.credentials.secret).toBe("at-1");
    expect(result.credentials.refreshSecret).toBe("rt-1");
    expect(result.credentials.config).toEqual({
      email: "founder@example.com",
      googleUserId: "108374",
    });
    expect(result.scopes).toContain("https://www.googleapis.com/auth/gmail.compose");
    expect(result.expiresAt).toBeTruthy();
  });

  it("refuses a connection where the user withheld compose permission", async () => {
    stubFetch([
      {
        match: "oauth2.googleapis.com/token",
        json: { access_token: "at-1", scope: "openid email" },
      },
    ]);

    await expect(
      gmailAdapter.connect({
        method: "oauth",
        code: "code-1",
        state: "gmail.nonce",
        redirectUri: REDIRECT,
      })
    ).rejects.toThrow(/permission/i);
  });
});

describe("gmailAdapter.createDraft", () => {
  it("creates a draft carrying the recipients and subject", async () => {
    const calls = stubFetch([
      { match: "/drafts", json: { id: "draft-1", message: { id: "msg-1" } } },
    ]);

    const result = await gmailAdapter.createDraft({ ...sessionWith(), content });

    expect(result.externalId).toBe("draft-1");
    expect(result.status).toBe("draft");

    const raw = (bodyOf(calls[0]).message as { raw: string }).raw;
    const mime = decodeRaw(raw);
    expect(mime).toContain("To: a@example.com, b@example.com");
    expect(mime).toContain("Subject: Quick follow-up");
    expect(calls[0].init.method).toBe("POST");
  });

  it("sends From the connected mailbox, never the Google subject id", async () => {
    const calls = stubFetch([{ match: "/drafts", json: { id: "draft-1" } }]);
    await gmailAdapter.createDraft({ ...sessionWith(), content });
    const mime = decodeRaw((bodyOf(calls[0]).message as { raw: string }).raw);
    expect(mime).toContain("From: founder@example.com");
    expect(mime).not.toContain("From: 108374");
  });

  it("won't build a draft with no recipient", async () => {
    stubFetch([{ match: "/drafts", json: { id: "draft-1" } }]);
    await expect(
      gmailAdapter.createDraft({
        ...sessionWith(),
        content: { ...content, audience: null },
      })
    ).rejects.toThrow(/at least one recipient/i);
  });
});

describe("gmailAdapter.publish", () => {
  it("sends the already-approved draft by id", async () => {
    const calls = stubFetch([
      { match: "/drafts/send", json: { id: "msg-9", threadId: "thread-9" } },
    ]);

    const result = await gmailAdapter.publish({
      ...sessionWith(),
      content,
      externalId: "draft-1",
    });

    expect(result.status).toBe("sent");
    expect(result.externalId).toBe("msg-9");
    expect(calls[0].url).toContain("/drafts/send");
    expect(bodyOf(calls[0])).toEqual({ id: "draft-1" });
  });
});

describe("gmailAdapter.schedule", () => {
  it("fails loudly rather than sending immediately", async () => {
    await expect(
      gmailAdapter.schedule({
        ...sessionWith(),
        content,
        externalId: "draft-1",
        scheduledFor: "2026-12-01T10:00:00.000Z",
      })
    ).rejects.toThrow(/can't schedule/i);
  });
});

describe("gmail token refresh", () => {
  it("refreshes an expired access token and hands the new one back to persist", async () => {
    const calls = stubFetch([
      {
        match: "oauth2.googleapis.com/token",
        json: { access_token: "at-2", expires_in: 3599 },
      },
      { match: "/drafts", json: { id: "draft-1", message: { id: "msg-1" } } },
    ]);

    const onCredentialsRefreshed = vi.fn(async () => {});
    const session = {
      ...sessionWith({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      onCredentialsRefreshed,
    };

    await gmailAdapter.createDraft({ ...session, content });

    expect(calls[0].url).toContain("oauth2.googleapis.com/token");
    expect(String(calls[0].init.body)).toContain("grant_type=refresh_token");
    expect(onCredentialsRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "at-2" })
    );

    // The Gmail call then uses the refreshed token.
    const draftCall = calls.find((c) => c.url.includes("/drafts"))!;
    expect((draftCall.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer at-2"
    );
  });

  it("asks the user to reconnect when there's no refresh token left", async () => {
    stubFetch([{ match: "/drafts", json: {} }]);
    const session = sessionWith({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      refreshSecret: null,
    });

    await expect(gmailAdapter.createDraft({ ...session, content })).rejects.toThrow(
      /reconnect/i
    );
  });
});
