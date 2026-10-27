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
  "20261022120000_chat_action_state.sql",
  "20261022121000_chat_action_commands.sql",
  "20261022122000_chat_handoff_tasks.sql",
  "20261022123000_chat_capability_publication.sql",
  "20261022124000_chat_action_read.sql",
  "20261023090000_chat_request_workflow.sql",
  "20261023091000_chat_agent_actions.sql",
  "20261023092000_chat_action_configuration.sql",
  "20261023093000_chat_public_outbox.sql",
  "20261023094000_chat_action_settings_read.sql",
  "20261023095000_chat_action_context.sql",
  "20261023100000_chat_handoff_labels.sql",
  "20261023101000_chat_supplemental_delivery.sql",
];
if (!process.argv.includes("--apply-owned-local")) {
  console.log(
    "Plan only: apply exactly thirteen CH6 migrations to the owned loopback database after pre/post native restore checks. Pass --apply-owned-local to execute.",
  );
  process.exit(0);
}
const folder = path.join(root, "supabase/migrations");
const names = (await readdir(folder)).filter((n) => n.endsWith(".sql")).sort();
const baseline = names.filter((n) => !allowed.includes(n));
assert.equal(
  baseline.length,
  83,
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
    backup = path.join(runtime, "ch6-" + label + "-" + name + ".dump");
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
  // All CH6 files are unapplied. Their literal top-level BEGIN;/COMMIT; pairs
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
          "select to_regprocedure('public.chat_request_workflow(jsonb,text,jsonb)') id",
        )
      ).rows[0].id,
      null,
      "CH-6 already present; refuse reapply.",
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
  const old = await inventory(db, false),
    copy = await restoreCopy("before");
  try {
    await apply(copy);
    const migrated = await inventory(copy, false);
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
  const migrated = await inventory(db, false);
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
          "select has_function_privilege('anon','public.chat_request_workflow(jsonb,text,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await finalCopy.query(
          "select has_function_privilege('authenticated','public.chat_request_workflow(jsonb,text,jsonb)','execute') allowed",
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
    path.join(runtime, "ch6-upgrade-report.json"),
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
