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
import { fixtures } from "./seed.mjs";

const allowed = [
  "20261021123000_chat_contacts_leads.sql",
  "20261021124000_chat_contact_lead_commands.sql",
  "20261021125000_chat_lead_refresh.sql",
];
const folder = path.join(root, "supabase/migrations");
const names = (await readdir(folder)).filter((n) => n.endsWith(".sql")).sort();
const baseline = names.filter((n) => !allowed.includes(n));
assert.equal(
  baseline.length,
  75,
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
  restores: [],
};
async function inventory(client, omitContact = false) {
  const tables = (
      await client.query(
        "select tablename from pg_tables where schemaname='public' order by tablename",
      )
    ).rows.map((r) => r.tablename),
    result = {};
  for (const table of tables) {
    assert.match(table, /^[a-z_][a-z0-9_]*$/);
    const value =
      omitContact && table === "chat_conversations"
        ? "(to_jsonb(r)-'contact_id')"
        : "to_jsonb(r)";
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
    backup = path.join(runtime, "ch3-" + label + "-" + name + ".dump");
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
  // Remove only each file's outer transaction; keep every PL/pgSQL BEGIN and nested transaction intact.
  const start = text.indexOf("begin;");
  assert.ok(
    start >= 0 &&
      text
        .slice(0, start)
        .split("\n")
        .every((line) => !line.trim() || line.trim().startsWith("--")),
  );
  assert.match(text.slice(start), /commit;\s*$/);
  return text.slice(start + 6).replace(/commit;\s*$/, "");
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
      (await client.query("select to_regclass('public.leads') id")).rows[0].id,
      null,
      "CH-3 already present; refuse reapply.",
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
let paused = false;
try {
  assert.equal(
    (await db.query("select checksum from local_qa.schema_version")).rows[0]
      ?.checksum,
    beforeChecksum,
    "Baseline checksum mismatch; no changes applied.",
  );
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
  report.backfill = [];
  for (const tenantId of [fixtures.A, fixtures.B]) {
    let cursor = null,
      scanned = 0;
    do {
      const ctx = {
        tenantId,
        actor: { type: "SYSTEM", id: "chat-history-backfill" },
        source: "AUTOMATION",
        correlationId: randomUUID(),
      };
      const result = (
        await db.query("select chat_lead_backfill($1::jsonb,$2::uuid) result", [
          JSON.stringify(ctx),
          cursor,
        ])
      ).rows[0].result;
      scanned += result.scanned;
      cursor = result.nextAfterId;
    } while (cursor);
    report.backfill.push({
      fixture: tenantId === fixtures.A ? "A" : "B",
      scanned,
    });
  }
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
    report.restoreAcl = "PASS";
  } finally {
    await finalCopy.end();
  }
  report.result = "PASS";
  await writeFile(
    path.join(runtime, "ch3-upgrade-report.json"),
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
      backfill: report.backfill,
    }),
  );
} finally {
  await db.end();
  if (paused) await compose(s, "up", "-d", "rest");
}
