import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import path from "node:path";
import {
  state,
  verifyContainer,
  connect,
  command,
  compose,
  runtime,
  root,
} from "./common.mjs";
import {
  state as chatwootState,
  owned as chatwootOwned,
  compose as chatwootCompose,
} from "../chatwoot-local/common.mjs";

const allowed = [
  "20261028100000_chat_website_phone_claims.sql",
  "20261028101000_chat_website_claim_reads.sql",
];
if (!process.argv.includes("--apply-owned-local")) {
  console.log(
    "Plan only: apply exactly two CH9 migrations to the owned loopback database after pre/post native restore checks. Pass --apply-owned-local to execute.",
  );
  process.exit(0);
}
const folder = path.join(root, "supabase/migrations");
const names = (await readdir(folder)).filter((n) => n.endsWith(".sql")).sort();
const baseline = names.filter((n) => !allowed.includes(n));
assert.equal(
  baseline.length,
  104,
  "Unexpected migration baseline; review instead of replaying.",
);
const bytes = new Map(
  await Promise.all(
    names.map(async (n) => [n, await readFile(path.join(folder, n))]),
  ),
);
function checksum(list) {
  const hash = createHash("sha256");
  for (const name of list) {
    hash.update(name);
    hash.update(bytes.get(name));
  }
  return hash.digest("hex");
}
const beforeChecksum = checksum(baseline),
  afterChecksum = checksum(names);
const s = await state(),
  container = await verifyContainer(s, "db");
await verifyContainer(s, "rest");
const db = await connect(s);
const report = {
  at: new Date().toISOString(),
  destination: "owned loopback PostgreSQL15437 only",
  beforeChecksum,
  afterChecksum,
  migrations: allowed,
  migrationHashes: allowed.map((name) => ({
    name,
    sha256: createHash("sha256").update(bytes.get(name)).digest("hex"),
  })),
  restores: [],
};
async function inventory(client, preserve = false) {
  const tables = (
      await client.query(
        "select tablename from pg_tables where schemaname='public' order by tablename",
      )
    ).rows.map((r) => r.tablename),
    result = {};
  for (const table of tables) {
    assert.match(table, /^[a-z_][a-z0-9_]*$/);
    const additions = [];
    const value =
      "(to_jsonb(r)-ARRAY[" +
      additions.map((c) => "'" + c + "'").join(",") +
      "]::text[])";
    result[table] = (
      await client.query(
        "select count(*)::int count,md5(coalesce(string_agg(" +
          value +
          "::text,chr(10) order by " +
          value +
          "::text),'')) hash from public.\"" +
          table +
          '\" r',
      )
    ).rows[0];
  }
  return result;
}
async function restoreCopy(label) {
  const manifest = await inventory(db),
    dump = await command(
      "docker",
      ["exec", container, "pg_dump", "-U", "postgres", "-Fc", "postgres"],
      { binary: true },
    );
  const name = "chat_restore_" + randomBytes(6).toString("hex"),
    backup = path.join(runtime, "ch9-" + label + "-" + name + ".dump");
  await writeFile(backup, dump, { mode: 0o600, flag: "wx" });
  await db.query('create database "' + name + '"');
  await command(
    "docker",
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "--exit-on-error",
      "--dbname",
      name,
    ],
    { input: dump },
  );
  const copy = await connect(s, name);
  try {
    assert.deepEqual(await inventory(copy), manifest);
  } catch (error) {
    await copy.end();
    throw error;
  }
  report.restores.push({
    label,
    database: name,
    backup: path.basename(backup),
    tables: Object.keys(manifest).length,
    bytes: dump.length,
    sha256: createHash("sha256").update(dump).digest("hex"),
  });
  return copy;
}
function body(source) {
  const text = source.toString("utf8");
  // All CH9 files are unapplied. Their literal top-level BEGIN;/COMMIT; pairs
  // are folded into one upgrade transaction; PL/pgSQL uses BEGIN without ';'.
  const lines = text.split(/\r?\n/);
  const opens = lines.filter((line) => /^begin;$/i.test(line.trim())).length;
  const closes = lines.filter((line) => /^commit;$/i.test(line.trim())).length;
  assert.ok(opens > 0 && opens === closes, "Unexpected migration transactions");
  return lines
    .filter((line) => !/^(begin|commit);$/i.test(line.trim()))
    .join("\n");
}
async function apply(client) {
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(870123451)");
    assert.equal(
      (await client.query("select checksum from local_qa.schema_version"))
        .rows[0]?.checksum,
      beforeChecksum,
      "Local schema marker changed.",
    );
    assert.equal(
      (
        await client.query(
          "select to_regclass('public.chat_website_phone_claims') id",
        )
      ).rows[0].id,
      null,
      "CH-9 already present; refuse reapply.",
    );
    for (const name of allowed) await client.query(body(bytes.get(name)));
    await client.query("update local_qa.schema_version set checksum=$1", [
      afterChecksum,
    ]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
const cw = await chatwootState();
await chatwootOwned(cw);
let paused = false,
  workerPaused = false;
try {
  assert.equal(
    (await db.query("select checksum from local_qa.schema_version")).rows[0]
      ?.checksum,
    beforeChecksum,
    "Baseline checksum mismatch; no changes applied.",
  );
  await chatwootCompose("stop", "sidekiq");
  workerPaused = true;
  await compose(s, "stop", "rest");
  paused = true;
  const old = await inventory(db, true),
    copy = await restoreCopy("before");
  try {
    await apply(copy);
    const migrated = await inventory(copy, true);
    for (const [table, value] of Object.entries(old))
      assert.deepEqual(
        migrated[table],
        value,
        "Existing data changed: " + table,
      );
  } finally {
    await copy.end();
  }
  await apply(db);
  report.applied = "owned persistent LOCAL database only";
  const migrated = await inventory(db, true);
  for (const [table, value] of Object.entries(old))
    assert.deepEqual(migrated[table], value, "Existing data changed: " + table);
  report.existingDataPreserved = Object.keys(old).length;
  const finalCopy = await restoreCopy("after");
  try {
    assert.equal(
      (
        await finalCopy.query(
          "select has_table_privilege('anon','leads','select') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await finalCopy.query(
          "select has_function_privilege('anon','public.chat_crm_read(jsonb,text,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await finalCopy.query(
          "select has_function_privilege('authenticated','public.chat_capture(jsonb,text,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        (
          await finalCopy.query(
            "select has_table_privilege($1,'public.chat_website_phone_claims','select') allowed",
            [role],
          )
        ).rows[0].allowed,
        false,
      );
    }
    report.restoreAcl = "PASS";
  } finally {
    await finalCopy.end();
  }
  report.result = "PASS";
  await writeFile(
    path.join(runtime, "ch9-upgrade-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      applied: report.applied,
      existingTablesPreserved: report.existingDataPreserved,
      restores: report.restores.map((r) => ({
        label: r.label,
        tables: r.tables,
        bytes: r.bytes,
        database: r.database,
      })),
      migrationCount: allowed.length,
    }),
  );
} finally {
  await db.end();
  if (paused) await compose(s, "up", "-d", "rest");
  if (workerPaused) await chatwootCompose("up", "-d", "sidekiq");
}
