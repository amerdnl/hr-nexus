/**
 * The public demo, end to end against a real PostgreSQL server.
 *
 * Proves at the API, not in the interface, that the published demo account is
 * the only account that can sign in, that it can open every module, and that
 * each kind of change it must not make - settings,
 * policies, its own email and password, users, deletions and every other write -
 * is refused and leaves the database exactly as it was. Also proves the nightly
 * reset: it needs the secret, undoes any change to the data, and refuses a
 * database that is not a demo.
 *
 * SAFETY. Runs only when HR_NEXUS_DEMO_TEST_SERVER_URL names a server, e.g. the
 * local demo stack's Postgres:
 *
 *   HR_NEXUS_DEMO_TEST_SERVER_URL=postgresql://postgres:<password>@127.0.0.1:5436/postgres \
 *     node --import tsx --test tests/demo-readonly.integration.test.ts
 *
 * It creates a throwaway database with a random name on that server, builds it
 * from schema.sql and the migrations, and drops it afterwards. It never touches
 * any database it did not create.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import pg from "pg";

const serverUrl = process.env.HR_NEXUS_DEMO_TEST_SERVER_URL;

test("public demo: read-only account and nightly reset", { skip: !serverUrl }, async (t) => {
  const name = `hr_nexus_demo_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Pool({ connectionString: serverUrl, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(serverUrl!);
  url.pathname = `/${name}`;
  const db = new pg.Pool({ connectionString: url.toString(), max: 2 });
  let server: Server | null = null;
  let appPool: pg.Pool | null = null;

  try {
    await db.query(await readFile(new URL("../../database/schema.sql", import.meta.url), "utf8"));
    const { runMigrations } = await import("../src/database/migrations.js");
    await runMigrations(db, { mode: "apply", database: name });

    const cronSecret = randomBytes(24).toString("hex");
    const jwtSecret = randomBytes(32).toString("hex");
    Object.assign(process.env, {
      DATABASE_URL: url.toString(), JWT_SECRET: jwtSecret,
      DEMO_MODE: "true", CRON_SECRET: cronSecret,
    });

    const { resetDemoDatabase } = await import("../src/database/demoReset.js");
    const {
      presentationAdmin, presentationDemoAccount, presentationEmployeeAccount, presentationManagerAccount,
    } = await import("../src/database/presentationData.js");
    const client = await db.connect();
    try { await resetDemoDatabase(client); } finally { client.release(); }

    const { default: app } = await import("../src/app.js");
    appPool = (await import("../src/config/db.js")).default;
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

    const call = async (method: string, path: string, token?: string, body?: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let json: { success?: boolean; code?: string; message?: string; data?: any } = {};
      try { json = JSON.parse(text); } catch { /* a CSV export */ }
      return { status: response.status, body: json };
    };
    const signIn = async (email: string, password: string) => {
      const result = await call("POST", "/auth/login", undefined, { email, password });
      assert.equal(result.status, 200, `${email} signs in`);
      return { token: result.body.data.token as string, user: result.body.data.user };
    };

    const demo = await signIn(presentationDemoAccount.email, presentationDemoAccount.password);

    /** Every row of every table, hashed: proves "nothing changed", not just "these tables did not". */
    const fingerprint = async () => {
      const tables = (await db.query<{ name: string }>(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      )).rows.map((row) => row.name);
      const parts: Record<string, string> = {};
      for (const table of tables) {
        parts[table] = (await db.query<{ digest: string }>(
          `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS digest FROM public."${table}" t`,
        )).rows[0]!.digest;
      }
      return parts;
    };

    await t.test("the demo sign-in is an administrator flagged read-only", () => {
      assert.equal(demo.user.role, "admin");
      assert.equal(demo.user.isDemo, true);
    });

    await t.test("no other account can sign in or hold a session", async () => {
      const others = [presentationAdmin, presentationManagerAccount, presentationEmployeeAccount];
      const accounts = await db.query<{ email: string; password_hash: string; demo_read_only: boolean }>(
        "SELECT email, password_hash, demo_read_only FROM public.users ORDER BY id",
      );
      assert.deepEqual(
        accounts.rows.filter((row) => row.demo_read_only).map((row) => row.email),
        [presentationDemoAccount.email],
        "the demo account is the only read-only account",
      );
      for (const row of accounts.rows.filter((account) => !account.demo_read_only)) {
        assert.equal(row.password_hash, "!no-sign-in", `${row.email} has no usable password`);
      }
      for (const account of others) {
        for (const password of [presentationDemoAccount.password, "!no-sign-in", "", "password"]) {
          const result = await call("POST", "/auth/login", undefined, { email: account.email, password });
          assert.ok([400, 401].includes(result.status), `${account.email} cannot sign in (${result.status})`);
        }
      }
      // Even with a real password hash, demo mode refuses any account but the demo one.
      const bcrypt = (await import("bcryptjs")).default;
      await db.query("UPDATE public.users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash("known-password", 4), presentationAdmin.id]);
      const known = await call("POST", "/auth/login", undefined, { email: presentationAdmin.email, password: "known-password" });
      assert.equal(known.status, 401, "a non-demo account is refused like a wrong password");
      assert.equal(known.body.message, "Invalid email or password");
      // And a correctly signed token for another account opens nothing.
      const forged = jwt.sign({ role: "admin", employeeId: null }, jwtSecret, { subject: String(presentationAdmin.id), expiresIn: "5m" });
      assert.equal((await call("GET", "/people", forged)).status, 401);
      assert.equal((await call("POST", "/departments", forged, { name: "Visitors" })).status, 401);
    });

    await t.test("the demo account can open every module", async () => {
      const period = (await db.query<{ id: string }>(
        "SELECT id FROM public.payroll_periods WHERE status = 'paid' ORDER BY period_year DESC, period_month DESC LIMIT 1",
      )).rows[0]!.id;
      const cycle = (await db.query<{ id: string }>("SELECT id FROM public.review_cycles WHERE status = 'open'")).rows[0]!.id;
      for (const path of [
        "/auth/me", "/people", "/people/9203", "/org/chart", "/employees", "/departments",
        "/attendance", "/attendance/statistics", "/leaves", "/leaves/policies",
        "/payroll/periods", `/payroll/periods/${period}`, `/payroll/periods/${period}/summary`,
        "/reviews/cycles", `/reviews/cycles/${cycle}`, "/lifecycle/plans", "/lifecycle/templates",
        "/reports/workforce", "/reports/attendance", "/reports/leave", `/reports/payroll/${period}`,
        "/audit", "/settings", "/settings/holidays", "/action-center", "/notifications", "/announcements",
        "/recognition", `/calendar?from=${new Date().toISOString().slice(0, 8)}01&to=${new Date().toISOString().slice(0, 8)}28`, "/analytics/company", "/search?q=nur",
      ]) {
        const result = await call("GET", path, demo.token);
        assert.equal(result.status, 200, `GET ${path} -> ${result.status} ${result.body.message ?? ""}`);
      }
    });

    await t.test("every blocked action is refused at the API and changes nothing", async () => {
      const before = await fetchState();
      const blocked: Array<[string, string, unknown?]> = [
        // Settings and policies.
        ["PUT", "/settings", { company_name: "Changed by a visitor" }],
        ["PUT", "/leaves/policies/annual", { default_annual_days: 99 }],
        ["POST", "/settings/holidays", { holiday_date: "2030-01-02", name: "Visitor day" }],
        ["PUT", "/dashboard/layout", { version: 1, items: [] }],
        // Its own email and password.
        ["PUT", "/profile/password", { currentPassword: presentationDemoAccount.password, newPassword: "a-new-password-123" }],
        ["PUT", "/profile", { email: "visitor@example.com" }],
        // Users, invitations and roles.
        ["POST", "/employees", { full_name: "Visitor", email: "visitor@example.com", role: "admin" }],
        ["PUT", "/employees/9205", { job_title: "Chief Visitor" }],
        ["PATCH", "/employees/9205/reactivate"],
        ["POST", "/import/jobs"],
        // Deleting anything.
        ["DELETE", "/employees/9205"],
        ["DELETE", "/employees/9205/permanent"],
        ["DELETE", "/departments/1"],
        ["DELETE", "/announcements/1"],
        ["DELETE", "/calendar/events/1"],
        ["DELETE", "/settings/holidays/1"],
        ["DELETE", "/org/positions/9240"],
        ["DELETE", "/org/relationships/9205/9203"],
        ["DELETE", "/payroll/records/1/items/1"],
        ["DELETE", "/dashboard/layout"],
        ["DELETE", "/profile/image"],
        // Every other write an administrator could make.
        ["POST", "/departments", { name: "Visitors" }],
        ["POST", "/announcements", { title: "Hello", body: "From a visitor" }],
        ["POST", "/org/positions", { title: "Visitor" }],
        ["PUT", "/leaves/1/status", { status: "approved" }],
        ["POST", "/payroll/periods", { year: 2030, month: 1 }],
        ["PUT", "/payroll/periods/1/status", { status: "approved" }],
        ["POST", "/attendance/manual", {}],
        ["POST", "/attendance/qr"],
        ["POST", "/lifecycle/plans", {}],
        ["POST", "/reviews/cycles", {}],
        ["PUT", "/recognition/1/hidden", { hidden: true }],
      ];
      for (const [method, path, body] of blocked) {
        const result = await call(method, path, demo.token, body ?? {});
        assert.equal(result.status, 403, `${method} ${path} -> ${result.status}`);
        assert.equal(result.body.code, "DEMO_READ_ONLY", `${method} ${path} is refused as a demo write`);
        assert.match(result.body.message ?? "", /disabled in the demo/);
      }
      assert.deepEqual(await fetchState(), before, "no table changed");
      // The password still works, so the change really was refused.
      await signIn(presentationDemoAccount.email, presentationDemoAccount.password);
    });

    await t.test("only its own read markers and signing out are allowed", async () => {
      assert.equal((await call("PUT", "/notifications/read-all", demo.token)).status, 200);
      const unread = await db.query("SELECT count(*)::int AS n FROM public.notifications WHERE user_id = $1 AND read_at IS NULL", [presentationDemoAccount.id]);
      assert.equal(unread.rows[0].n, 0);
      assert.equal((await call("POST", "/auth/logout", demo.token)).status, 200);
    });

    await t.test("the reset needs the secret, then restores the demo", async () => {
      await db.query("INSERT INTO public.departments (name, description) VALUES ('Visitors'' Lounge', 'Changed behind the API')");
      assert.equal((await call("GET", "/demo/reset")).status, 401);
      assert.equal((await fetch(`${base}/demo/reset`, { headers: { Authorization: "Bearer not-the-secret-not-the-secret" } })).status, 401);
      const reset = await fetch(`${base}/demo/reset`, { headers: { Authorization: `Bearer ${cronSecret}` } });
      assert.equal(reset.status, 200);
      const gone = await db.query("SELECT count(*)::int AS n FROM public.departments WHERE name = 'Visitors'' Lounge'");
      assert.equal(gone.rows[0].n, 0, "the change is undone");
      const hash = await db.query<{ password_hash: string }>("SELECT password_hash FROM public.users WHERE id = $1", [presentationAdmin.id]);
      assert.equal(hash.rows[0]!.password_hash, "!no-sign-in", "the reset takes away the password set above");
      const unread = await db.query("SELECT count(*)::int AS n FROM public.notifications WHERE user_id = $1 AND read_at IS NULL", [presentationDemoAccount.id]);
      assert.ok(unread.rows[0].n > 0, "the demo account has fresh unread news again");
      await signIn(presentationDemoAccount.email, presentationDemoAccount.password);
      const info = await call("GET", "/demo");
      assert.equal(info.body.data.email, presentationDemoAccount.email);
    });

    await t.test("the reset refuses a database that holds anyone outside the demo", async () => {
      await db.query(
        "INSERT INTO public.employees (id, employee_number, full_name, employment_status) VALUES (1, 'REAL-1', 'A real person', 'active')",
      );
      const client = await db.connect();
      try {
        await assert.rejects(resetDemoDatabase(client), { code: "NOT_A_DEMO_DATABASE" });
      } finally { client.release(); }
      const still = await db.query("SELECT count(*)::int AS n FROM public.employees WHERE id = 1");
      assert.equal(still.rows[0].n, 1, "nothing was truncated");
      const viaApi = await fetch(`${base}/demo/reset`, { method: "POST", headers: { Authorization: `Bearer ${cronSecret}` } });
      assert.equal(viaApi.status, 422);
    });

    async function fetchState() {
      return fingerprint();
    }
  } finally {
    if (server) { server.close(); await once(server, "close").catch(() => undefined); }
    await appPool?.end().catch(() => undefined);
    await db.end();
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
});
