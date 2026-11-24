import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/** Whether this deployment is the public demo. Anything but the exact string "true" is no. */
export const isDemoMode = () => process.env.DEMO_MODE === "true";

/**
 * Constant-time comparison of the bearer token with CRON_SECRET, which Vercel
 * Cron sends as `Authorization: Bearer <CRON_SECRET>`. A missing or short
 * secret is never satisfied, so an unset variable cannot open the reset.
 */
export function hasResetSecret(request: Pick<Request, "headers">, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16) return false;
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
