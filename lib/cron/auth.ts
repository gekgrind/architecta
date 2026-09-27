import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Cron endpoints authenticate with `Authorization: Bearer <CRON_SECRET>`.
 * Fails closed: with CRON_SECRET unset nothing is authorized. Same check as
 * /api/cron/publish.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
