import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  checkTransactionBoundaries, COMMENT_ONLY_REVISIONS, executableSql, loadMigrations, MigrationError,
} from "../src/database/migrations.js";

for (const sql of [
  "COMMIT;", "/* outer /* nested */ comment */ ROLLBACK;", "SELECT 1; -- comment\nBEGIN;",
  "START TRANSACTION;", "END;", "PREPARE TRANSACTION 'id';", "SET search_path = elsewhere;",
  "SELECT ';COMMIT;'; COMMIT;", "DO $$ BEGIN NULL; END $$; COMMIT;",
]) test(`reject top-level transaction/session control: ${sql}`, () => {
  assert.throws(() => checkTransactionBoundaries(sql), { code: "TRANSACTION_CONTROL" });
});

test("allow PL/pgSQL bodies, quoted keywords, escaped strings and nested comments", () => {
  checkTransactionBoundaries("DO $body$ BEGIN RAISE NOTICE 'COMMIT'; END $body$; SELECT 'ROLLBACK', E'escaped\\\'quote', \"BEGIN\"; /* /* nested */ */");
});

test("migration loader checks consecutive filenames and exact byte checksums", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hr-nexus-migrations-"));
  try {
    const contents = "SELECT 1;\r\n";
    await writeFile(path.join(dir, "0001_baseline.sql"), contents);
    const migrations = await loadMigrations(dir);
    assert.equal(migrations[0]!.checksum, createHash("sha256").update(contents).digest("hex"));
    await writeFile(path.join(dir, "0003_gap.sql"), "SELECT 3;");
    await assert.rejects(loadMigrations(dir), { code: "INVALID_ORDER" });
    await rm(path.join(dir, "0003_gap.sql"));
    await writeFile(path.join(dir, "0001_duplicate.sql"), "SELECT 2;");
    await assert.rejects(loadMigrations(dir), { code: "INVALID_ORDER" });
    await rm(path.join(dir, "0001_duplicate.sql"));
    await writeFile(path.join(dir, "bad.sql"), "SELECT 3;");
    await assert.rejects(loadMigrations(dir), { code: "INVALID_FILENAME" });
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("unclosed quotes/comments are rejected before database access", () => {
  for (const sql of ["/*", "SELECT 'x", "DO $$ BEGIN"]) {
    assert.throws(() => checkTransactionBoundaries(sql), MigrationError);
  }
});

test("comment-only revisions changed no executable SQL", async () => {
  const migrations = await loadMigrations();
  for (const [version, revision] of Object.entries(COMMENT_ONLY_REVISIONS)) {
    const migration = migrations.find((entry) => entry.version === version);
    assert.ok(migration, `migration ${version} exists`);
    assert.ok(!revision.previousChecksums.includes(migration.checksum), `${version} was actually revised`);
    assert.equal(
      createHash("sha256").update(executableSql(migration.sql)).digest("hex"),
      revision.executableSha256,
      `${version}: only comments may differ from the applied file`,
    );
  }
});

test("executableSql drops comments but keeps quoted text", () => {
  assert.equal(
    executableSql("SELECT '-- kept', \"/* kept */\" -- gone\n/* gone /* nested */ */ FROM t; DO $b$ -- kept $b$;"),
    "SELECT '-- kept', \"/* kept */\" FROM t; DO $b$ -- kept $b$;",
  );
});
