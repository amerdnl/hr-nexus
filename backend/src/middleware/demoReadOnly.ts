/**
 * The read-only rule for published demo accounts (`users.demo_read_only`).
 *
 * Default deny. A demo account may read anything its role allows, and may make
 * exactly the requests listed in DEMO_ALLOWED_WRITES, each of which changes
 * nothing but that account's own "I have seen this" markers or ends its
 * session. Everything else that is not a read - settings, policies, its own
 * email or password, users and invitations, every deletion, every workflow
 * step - is refused before the route runs. The check lives in the
 * authentication middleware, so a route added later is covered without anyone
 * remembering to cover it, and the interface only explains the refusal.
 */
import type { Request, Response } from "express";

export const DEMO_READ_ONLY_CODE = "DEMO_READ_ONLY";

export const DEMO_READ_ONLY_MESSAGE =
  "This is disabled in the demo. You can look at everything, but changes are turned off.";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Writes that touch only the demo account's own read markers or session. */
export const DEMO_ALLOWED_WRITES: ReadonlyArray<{ method: string; path: RegExp; why: string }> = [
  { method: "POST", path: /^\/api\/auth\/logout$/, why: "signing out" },
  { method: "PUT", path: /^\/api\/notifications\/read-all$/, why: "marking its own notifications read" },
  { method: "PUT", path: /^\/api\/notifications\/\d+\/read$/, why: "marking one of its own notifications read" },
  { method: "PUT", path: /^\/api\/announcements\/\d+\/read$/, why: "marking an announcement read" },
];

/** Whether a demo account may make this request. `path` excludes the query string. */
export function isDemoRequestAllowed(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (READ_METHODS.has(verb)) return true;
  return DEMO_ALLOWED_WRITES.some((entry) => entry.method === verb && entry.path.test(path));
}

/** The request's own path, as the client sent it, without the query string. */
export function requestPath(request: Request): string {
  return (request.originalUrl || request.url).split("?")[0] ?? "";
}

export function refuseDemoWrite(response: Response): void {
  response.status(403).json({
    success: false,
    code: DEMO_READ_ONLY_CODE,
    message: DEMO_READ_ONLY_MESSAGE,
  });
}
