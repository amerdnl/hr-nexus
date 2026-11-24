/**
 * The public demo's two endpoints. Both exist only while DEMO_MODE=true; on any
 * other deployment they answer 404, exactly like a route that was never there.
 *
 *  GET      /api/demo        The published demo sign-in, so the login page can
 *                            offer "Use demo account". It is public on purpose:
 *                            the account it names cannot change anything.
 *  GET|POST /api/demo/reset  Rebuilds the demo database for today. Requires
 *                            `Authorization: Bearer <CRON_SECRET>`, which is
 *                            what Vercel Cron sends when CRON_SECRET is set.
 */
import { Router, type Request, type Response } from "express";
import pool from "../config/db.js";
import { DemoResetError, resetDemoDatabase } from "../database/demoReset.js";
import { presentationDemoAccount } from "../database/presentationData.js";
import { hasResetSecret, isDemoMode } from "../utils/demoSecret.js";

function notFound(response: Response): void {
  response.status(404).json({ success: false, message: "API endpoint not found" });
}

const router = Router();

router.get("/", (_request, response) => {
  if (!isDemoMode()) return notFound(response);
  response.status(200).json({
    success: true,
    message: "This is a public demo with fictional data. The demo account can look at everything and change nothing.",
    data: {
      email: presentationDemoAccount.email,
      password: presentationDemoAccount.password,
      resetsDaily: true,
    },
  });
});

async function reset(request: Request, response: Response): Promise<void> {
  if (!isDemoMode()) return notFound(response);
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16) {
    response.status(503).json({ success: false, message: "The demo reset is not configured. Set CRON_SECRET (16+ characters)." });
    return;
  }
  if (!hasResetSecret(request)) {
    response.status(401).json({ success: false, message: "A valid reset secret is required." });
    return;
  }

  const client = await pool.connect();
  try {
    const summary = await resetDemoDatabase(client);
    response.status(200).json({ success: true, message: "Demo data restored.", data: summary });
  } catch (error) {
    if (error instanceof DemoResetError) {
      response.status(error.code === "RESET_BUSY" ? 409 : 422).json({ success: false, code: error.code, message: error.message });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}

router.get("/reset", reset);
router.post("/reset", reset);

export default router;
