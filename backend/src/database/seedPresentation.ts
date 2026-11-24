/**
 * Loads the Meridian presentation company.
 *
 * SAFETY, before anything else. This script writes thousands of rows, so it is
 * built to refuse the wrong database rather than to be used carefully:
 *
 *  - It reads `PRESENTATION_DATABASE_URL` and never falls back to
 *    `DATABASE_URL`. The application's connection string cannot be picked up.
 *  - `--database <name>` must match the database it actually connected to, so a
 *    stale URL in the environment cannot silently redirect the write.
 *  - If the target is the application's configured database it stops, with no
 *    override flag at all: the presentation company never belongs there.
 *  - Every write is confined to identifiers 9200-9299 and to rows owned by
 *    them, and the run is one transaction that is checked before it commits.
 *
 * TIME. The company's own today, in Asia/Kuala_Lumpur, decides what "now"
 * means: attendance today, who is away, what is overdue and what is upcoming.
 * Rebuilding on another day produces a company that is coherent on that day.
 * Within one day the result is deterministic, because the only variation comes
 * from a seeded generator keyed to the date.
 *
 * PASSWORDS. A plaintext password is never stored. `PRESENTATION_PASSWORD` is
 * hashed with bcrypt and only the hash is written; without it a random password
 * is generated and printed once, here, so it exists nowhere but the terminal.
 * The read-only demo sign-in always uses its published password, from
 * presentationData.ts.
 *
 * The rows themselves are written by presentationLoader.ts, which the nightly
 * demo reset shares.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { PRESENTATION_ID_MAX, PRESENTATION_ID_MIN, presentationDemoAccount } from "./presentationData.js";
import { companyNow, loadPresentationCompany } from "./presentationLoader.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function fail(message: string): never {
  console.error(`Refusing to seed the presentation company: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.PRESENTATION_DATABASE_URL;
  if (!url) {
    fail("PRESENTATION_DATABASE_URL is required; this script never defaults to the application's database.");
  }
  const expected = argument("database");
  if (!expected) fail("--database <name> is required, and must name the database you intend to write.");

  const password = process.env.PRESENTATION_PASSWORD || randomBytes(9).toString("base64url");
  const generated = !process.env.PRESENTATION_PASSWORD;

  const seedPool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await seedPool.connect();

  try {
    const actual = (await client.query<{ name: string }>("SELECT current_database() AS name")).rows[0]!.name;
    if (actual !== expected) fail(`connected to "${actual}" but --database said "${expected}".`);

    const appUrl = process.env.DATABASE_URL;
    if (appUrl && new URL(appUrl).pathname.replace(/^\//, "") === actual) {
      fail(`"${actual}" is the application's configured database. The presentation company is never written there.`);
    }

    // A rebuild starts from an empty database: scripts/presentation-reset.sh
    // drops and recreates it, and the seed then writes the whole company. But
    // `docker compose up` runs this step again on every start, and by then the
    // company is already there - including payroll that has been approved, which
    // the database refuses to delete or rewrite because approved payroll is
    // immutable. That refusal is correct, and the seed has no business working
    // around it. With --skip-if-loaded, a start that finds the company already
    // present leaves it exactly as it is and succeeds, so bringing the
    // environment up a second time is not an error.
    if (process.argv.includes("--skip-if-loaded")) {
      const loaded = await client.query<{ count: string }>(
        "SELECT count(*)::int AS count FROM public.employees WHERE id BETWEEN $1 AND $2",
        [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX],
      );
      if (Number(loaded.rows[0]!.count) > 0) {
        console.log(
          `The presentation company is already loaded in "${actual}" ` +
          `(${loaded.rows[0]!.count} records in ${PRESENTATION_ID_MIN}-${PRESENTATION_ID_MAX}); leaving it unchanged. ` +
          `Run scripts/presentation-reset.sh to rebuild it from scratch.`,
        );
        return;
      }
    }

    // --today exists for verification only: it lets a rehearsal prove what the
    // environment looks like on a working day when the real one is a holiday.
    // The time of day comes from the real company clock unless --as-of says.
    const now = companyNow();
    const override = argument("today");
    if (override !== null && !/^20\d{2}-\d{2}-\d{2}$/.test(override)) fail("--today must be a date, as YYYY-MM-DD.");
    const asOf = argument("as-of");
    if (asOf !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(asOf)) fail("--as-of must be a time, as HH:MM.");
    const nowMinutes = asOf === null ? now.minutes : Number(asOf.slice(0, 2)) * 60 + Number(asOf.slice(3));

    const [staffPasswordHash, demoPasswordHash] = await Promise.all([
      bcrypt.hash(password, 12), bcrypt.hash(presentationDemoAccount.password, 12),
    ]);

    await client.query("BEGIN");

    // Nothing outside the reserved range may move; checked again before commit.
    const outside = `SELECT count(*)::text AS outside FROM public.employees
                     WHERE id < ${PRESENTATION_ID_MIN} OR id > ${PRESENTATION_ID_MAX}`;
    const before = await client.query<{ outside: string }>(outside);

    const summary = await loadPresentationCompany(client, {
      today: override ?? now.date, nowMinutes, staffPasswordHash, demoPasswordHash,
    });

    const after = await client.query<{ outside: string }>(outside);
    if (after.rows[0]!.outside !== before.rows[0]!.outside) {
      await client.query("ROLLBACK");
      fail(`the seed would have changed employees outside the reserved range (${before.rows[0]!.outside} to ${after.rows[0]!.outside}). Nothing was written.`);
    }

    await client.query("COMMIT");

    console.log(JSON.stringify({ database: actual, ...summary, employeesOutsideReservedRangeUnchanged: after.rows[0]!.outside }, null, 2));
    console.log(
      generated
        ? `\nGenerated password for the admin, manager and employee sign-ins (shown once, not stored): ${password}`
        : "\nThe admin, manager and employee sign-ins use the PRESENTATION_PASSWORD you supplied. Only its bcrypt hash was stored.",
    );
    console.log(`Read-only demo sign-in: ${presentationDemoAccount.email} / ${presentationDemoAccount.password}`);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* already gone */ }
    console.error("Presentation seed failed; nothing was written.", error);
    process.exit(1);
  } finally {
    client.release();
    await seedPool.end();
  }
}

await main();
