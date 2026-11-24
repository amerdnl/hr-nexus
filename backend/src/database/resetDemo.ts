/**
 * Rebuilds the public demo database from a terminal.
 *
 *   DEMO_DATABASE_URL='postgresql://…/<database>' npm run demo:reset -- --database <database>
 *
 * Reads DEMO_DATABASE_URL and never DATABASE_URL, and `--database` must name
 * the database the URL actually connects to. The reset itself refuses any
 * database holding people or accounts outside the demo range; see demoReset.ts.
 *
 * PRESENTATION_PASSWORD, if set, becomes the password of the HR administrator,
 * manager and employee sign-ins, for capturing those views locally. Leave it
 * unset for a public demo: they then get a random password nobody knows, and
 * only the read-only demo sign-in can be used.
 */
import pg from "pg";
import { presentationDemoAccount } from "./presentationData.js";
import { resetDemoDatabase } from "./demoReset.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function fail(message: string): never {
  console.error(`Refusing to reset the demo: ${message}`);
  process.exit(1);
}

const url = process.env.DEMO_DATABASE_URL;
if (!url) fail("DEMO_DATABASE_URL is required; this script never falls back to DATABASE_URL.");
const expected = argument("database");
if (!expected) fail("--database <name> is required, and must name the database you intend to rebuild.");

const pool = new pg.Pool({ connectionString: url, max: 1 });
const client = await pool.connect();
try {
  const actual = (await client.query<{ name: string }>("SELECT current_database() AS name")).rows[0]!.name;
  if (actual !== expected) fail(`connected to "${actual}" but --database said "${expected}".`);
  const summary = await resetDemoDatabase(client, { staffPassword: process.env.PRESENTATION_PASSWORD || undefined });
  console.log(JSON.stringify({ database: actual, ...summary }, null, 2));
  console.log(`\nDemo sign-in (read-only): ${presentationDemoAccount.email} / ${presentationDemoAccount.password}`);
  console.log(process.env.PRESENTATION_PASSWORD
    ? "The admin, manager and employee sign-ins use PRESENTATION_PASSWORD."
    : "The admin, manager and employee sign-ins have a random password that was not recorded.");
} catch (error) {
  console.error("Demo reset failed; the previous data is unchanged.", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
