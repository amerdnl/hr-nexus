/**
 * Rebuilds the public demo database from nothing: Meridian as it stands
 * on the company's today.
 *
 * Used by the nightly reset endpoint (`/api/demo/reset`, called by Vercel Cron)
 * and by `npm run demo:reset` from a terminal. Both reach it through a client
 * whose database the caller chose; nothing here reads DATABASE_URL.
 *
 * SAFETY. This empties every table, so it refuses any database that holds
 * anything but the demo:
 *
 *  - Every employee and every account must sit in the reserved demo range
 *    (9200-9299). A real company has people outside it, so a reset pointed at
 *    a real database by mistake stops before a single row is touched.
 *  - The whole rebuild is one transaction under an advisory lock, so two
 *    resets cannot interleave and a failure leaves the previous demo in place.
 *
 * WHY TRUNCATE. The product makes approved payroll, the audit log, recognition
 * and review history immutable with row triggers, which is right for a real
 * company and is exactly why a demo cannot be cleaned up row by row. TRUNCATE
 * does not fire row triggers; it is the "throw the whole company away" that
 * only a database holding nothing but the demo may receive.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { PRESENTATION_ID_MAX, PRESENTATION_ID_MIN, presentationDemoAccount } from "./presentationData.js";
import { companyNow, loadPresentationCompany, type LoadSummary } from "./presentationLoader.js";

const DEMO_RESET_LOCK = [1213353560, 1145392468] as const;

/** Today's attendance is drawn as of late morning at the earliest, so a reset at 03:00 does not show an empty office all day. */
export const DEMO_EARLIEST_AS_OF_MINUTES = 11 * 60 + 30;

export class DemoResetError extends Error {
  constructor(message: string, public readonly code: "NOT_A_DEMO_DATABASE" | "RESET_BUSY" | "NOT_MIGRATED") {
    super(message);
    this.name = "DemoResetError";
  }
}

/** The rows migrations 0002 and 0006 insert, which a full truncate takes away. */
async function restoreMigrationDefaults(client: PoolClient): Promise<void> {
  await client.query("INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  await client.query(
    `INSERT INTO public.leave_policies (leave_type, default_annual_days, deducts_balance, is_paid) VALUES
       ('annual', 12, TRUE, TRUE), ('medical', 10, TRUE, TRUE), ('emergency', 2, TRUE, TRUE), ('unpaid', 0, FALSE, FALSE)
     ON CONFLICT (leave_type) DO UPDATE SET default_annual_days = EXCLUDED.default_annual_days,
       deducts_balance = EXCLUDED.deducts_balance, is_paid = EXCLUDED.is_paid, active = TRUE`,
  );
}

/** Throws unless the connected database holds nothing but the demo company. */
export async function assertDemoDatabase(client: PoolClient): Promise<void> {
  const migrated = await client.query<{ ok: boolean }>(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '0023') AS ok`,
  ).catch(() => ({ rows: [{ ok: false }] }));
  if (!migrated.rows[0]?.ok) {
    throw new DemoResetError("The database is not migrated through 0023; apply the migrations first.", "NOT_MIGRATED");
  }
  const strangers = await client.query<{ employees: string; users: string }>(
    `SELECT (SELECT count(*) FROM public.employees WHERE id NOT BETWEEN $1 AND $2)::text AS employees,
            (SELECT count(*) FROM public.users WHERE id NOT BETWEEN $1 AND $2)::text AS users`,
    [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX],
  );
  const row = strangers.rows[0]!;
  if (Number(row.employees) > 0 || Number(row.users) > 0) {
    throw new DemoResetError(
      `Refusing to reset: this database holds ${row.employees} employees and ${row.users} accounts outside the demo range ` +
      `${PRESENTATION_ID_MIN}-${PRESENTATION_ID_MAX}, so it is not a demo database.`,
      "NOT_A_DEMO_DATABASE",
    );
  }
}

export interface DemoResetOptions {
  /** The moment to rebuild for. Defaults to now. */
  at?: Date;
  /** Password for the HR administrator, manager and employee sign-ins. A random, unrecorded one when omitted. */
  staffPassword?: string;
}

export async function resetDemoDatabase(client: PoolClient, options: DemoResetOptions = {}): Promise<LoadSummary & { durationMs: number }> {
  const started = Date.now();
  const now = companyNow(options.at);
  const [staffPasswordHash, demoPasswordHash] = await Promise.all([
    bcrypt.hash(options.staffPassword || randomBytes(24).toString("base64url"), 10),
    bcrypt.hash(presentationDemoAccount.password, 10),
  ]);

  await client.query("BEGIN");
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1::integer, $2::integer) AS acquired", [...DEMO_RESET_LOCK],
    );
    if (!lock.rows[0]?.acquired) throw new DemoResetError("Another demo reset is already running.", "RESET_BUSY");

    await assertDemoDatabase(client);

    const tables = await client.query<{ name: string }>(
      `SELECT quote_ident(tablename) AS name FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename`,
    );
    await client.query(
      `TRUNCATE TABLE ${tables.rows.map((table) => `public.${table.name}`).join(", ")} RESTART IDENTITY CASCADE`,
    );
    await restoreMigrationDefaults(client);

    const summary = await loadPresentationCompany(client, {
      today: now.date,
      nowMinutes: Math.max(now.minutes, DEMO_EARLIEST_AS_OF_MINUTES),
      staffPasswordHash,
      demoPasswordHash,
    });

    // The same check again, against what is about to be committed.
    await assertDemoDatabase(client);
    await client.query("COMMIT");
    return { ...summary, durationMs: Date.now() - started };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
