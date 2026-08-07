import "server-only";

import { DestinationConfigError, DestinationUnsupportedError } from "../types";

/**
 * Recipient parsing shared by the personal-mailbox adapters (Gmail, Outlook).
 * Both take a comma/semicolon-separated list typed by the user and both cap it
 * — a personal mailbox is for one-to-one and small-group sends, and a bulk
 * blast belongs in a Brevo campaign. The cap differs per provider, so it's an
 * argument rather than a constant.
 */

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseRecipientList(
  raw: string | null | undefined,
  limit: { max: number; overflowMessage: string }
): string[] {
  const parts = (raw ?? "")
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new DestinationConfigError("Add at least one recipient email address");
  }
  const invalid = parts.filter((p) => !EMAIL_RE.test(p));
  if (invalid.length) {
    throw new DestinationConfigError(
      `Not a valid email address: ${invalid.slice(0, 3).join(", ")}`
    );
  }
  if (parts.length > limit.max) {
    throw new DestinationUnsupportedError(limit.overflowMessage);
  }
  return Array.from(new Set(parts));
}
