import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { state, verifyContainer, connect, runtime } from "./common.mjs";
const mode = process.argv[2];
assert.ok(["view", "pii", "restore"].includes(mode));
const s = await state();
await verifyContainer(s, "db");
const db = await connect(s),
  t = "81000000-0000-4000-8000-000000000001",
  file = path.join(runtime, "ch9-viewer-grants-before.private.json");
try {
  let prior;
  try {
    prior = JSON.parse(await readFile(file));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    prior = (
      await db.query(
        "select * from chat_role_permissions where tenant_id=$1 and role='viewer'",
        [t],
      )
    ).rows;
    await writeFile(file, JSON.stringify(prior), { mode: 0o600, flag: "wx" });
  }
  if (mode === "restore") {
    await db.query("begin");
    try {
      await db.query(
        "delete from chat_role_permissions where tenant_id=$1 and role='viewer'",
        [t],
      );
      for (const row of prior)
        await db.query(
          "insert into chat_role_permissions select * from jsonb_populate_record(null::chat_role_permissions,$1::jsonb)",
          [JSON.stringify(row)],
        );
      await db.query(
        "insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json) values($1,'local_qa.grants_restored','tenant',$1,'SYSTEM','local-qa','AUTOMATION',$2,'{}')",
        [t, randomUUID()],
      );
      await db.query("commit");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  } else {
    const owner = (
      await db.query(
        "select clerk_user_id from tenant_users where tenant_id=$1 and email='owner-a+clerk_test@example.com' and role='owner_admin'",
        [t],
      )
    ).rows[0];
    assert.ok(owner);
    for (const permission of ["leads:view", "leads:pii"])
      await db.query(
        "select chat_configure($1::jsonb,'role.grant',$2::jsonb)",
        [
          JSON.stringify({
            tenantId: t,
            actor: { type: "USER", id: owner.clerk_user_id },
            source: "OS_PLUS_UI",
            correlationId: randomUUID(),
            idempotencyKey: randomUUID(),
          }),
          JSON.stringify({
            role: "viewer",
            permission,
            allowed: permission === "leads:view" || mode === "pii",
          }),
        ],
      );
  }
  console.log(
    JSON.stringify({ scope: "owned synthetic tenant A", viewerMode: mode }),
  );
} finally {
  await db.end();
}
