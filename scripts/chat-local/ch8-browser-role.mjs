import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { state, verifyContainer, connect, runtime } from "./common.mjs";
import { fixtures } from "./seed.mjs";
const role = process.argv[2];
if (!["manager", "viewer", "finance", "restore"].includes(role))
  throw new Error("Choose a synthetic QA role or restore.");
const s = await state();
await verifyContainer(s, "db");
const db = await connect(s);
try {
  const current = (
    await db.query(
      "select id,tenant_id,clerk_user_id,email,role,status from tenant_users where tenant_id=$1 and email='owner-a+clerk_test@example.com'",
      [fixtures.A],
    )
  ).rows;
  assert.equal(current.length, 1);
  assert.equal(current[0].status, "active");
  assert.ok(current[0].clerk_user_id);
  const file = path.join(runtime, "ch8-browser-role-before.private.json");
  let prior;
  try {
    prior = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    assert.equal(current[0].role, "owner_admin");
    prior = current[0];
    await writeFile(file, JSON.stringify(prior), { mode: 0o600, flag: "wx" });
  }
  assert.equal(prior.id, current[0].id);
  assert.equal(prior.tenant_id, fixtures.A);
  assert.equal(prior.role, "owner_admin");
  const next = role === "restore" ? prior.role : role;
  await db.query("begin");
  try {
    await db.query(
      "update tenant_users set role=$3 where tenant_id=$1 and id=$2",
      [fixtures.A, prior.id, next],
    );
    await db.query(
      "insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json) values($1,'local_qa.membership_role','tenant_user',$2,'SYSTEM','local-qa','AUTOMATION',$3,$4)",
      [
        fixtures.A,
        prior.id,
        randomUUID(),
        JSON.stringify({
          from: current[0].role,
          to: next,
          scope: "synthetic retained local QA only",
        }),
      ],
    );
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  assert.equal(
    (
      await db.query(
        "select role from tenant_users where tenant_id=$1 and id=$2",
        [fixtures.A, prior.id],
      )
    ).rows[0].role,
    next,
  );
  console.log(
    JSON.stringify({
      scope: "owned synthetic Local QA A",
      effectiveRole: next,
      restored: role === "restore",
      independentCredentialLogin: false,
    }),
  );
} finally {
  await db.end();
}
