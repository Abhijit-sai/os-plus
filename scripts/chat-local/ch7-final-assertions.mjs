import assert from "node:assert/strict";
import { readFile, writeFile, appendFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { state, verifyContainer, connect, runtime, root } from "./common.mjs";
import { fixtures } from "./seed.mjs";
const s = await state();
await verifyContainer(s, "db");
const db = await connect(s);
const checks = [];
try {
  const t = fixtures.A,
    o = "56df039f-e6f1-494b-bb4c-be52ad85bbbf";
  const order = (
    await db.query(
      "select total_amount,notes from orders where tenant_id=$1 and id=$2",
      [t, o],
    )
  ).rows[0];
  assert.equal(Number(order.total_amount), 2000);
  assert.match(order.notes, /edit verified/);
  checks.push("Retained Boutique order total and edited note unchanged");
  const items = (
    await db.query(
      "select id,workflow_id,final_price,customer_measurement_id from order_items where tenant_id=$1 and order_id=$2",
      [t, o],
    )
  ).rows;
  assert.equal(items.length, 2);
  assert.equal(new Set(items.map((x) => x.workflow_id)).size, 2);
  assert.equal(
    items.reduce((a, x) => a + Number(x.final_price), 0),
    2000,
  );
  assert.ok(
    items.every(
      (x) => x.customer_measurement_id === items[0].customer_measurement_id,
    ),
  );
  checks.push("Two distinct workflows and selected measurement preserved");
  const stages = (
    await db.query(
      "select order_item_id,sequence_number,status from item_stage_instances where tenant_id=$1 and order_item_id=any($2::uuid[]) order by sequence_number",
      [t, items.map((x) => x.id)],
    )
  ).rows;
  assert.equal(stages.length, 4);
  const top = stages.filter(
    (x) => x.order_item_id === "d3837b0f-a61a-44fe-8b0f-4553582e5c86",
  );
  assert.equal(top[0].status, "completed");
  assert.ok(["ready", "ready_to_start"].includes(top[1].status));
  checks.push("Retained production stage readiness and history preserved");
  const payments = (
    await db.query(
      "select amount from order_payments where tenant_id=$1 and order_id=$2",
      [t, o],
    )
  ).rows;
  assert.equal(payments.length, 1);
  assert.equal(Number(payments[0].amount), 300);
  assert.equal(Number(order.total_amount) - Number(payments[0].amount), 1700);
  checks.push(
    "Exactly one prior synthetic receipt300 and balance1700; no new payment",
  );
  const before = JSON.parse(
    await readFile(path.join(runtime, "ch6-role-backup.private.json"), "utf8"),
  );
  const member = (
    await db.query(
      "select role from tenant_users where tenant_id=$1 and id=$2",
      [before.tenant, before.member],
    )
  ).rows[0];
  assert.equal(member.role, before.role);
  const grants = (
    await db.query(
      "select role,permission,allowed from chat_role_permissions where tenant_id=$1 and role in ('viewer','finance') order by role,permission",
      [before.tenant],
    )
  ).rows;
  assert.deepEqual(
    grants,
    before.grants.sort((a, b) =>
      (a.role + a.permission).localeCompare(b.role + b.permission),
    ),
  );
  checks.push(
    "Original owner membership and exact viewer/finance Chat grants restored",
  );
  const targets = (
    await db.query(
      "select tenant_id,is_active,recipient_enc,recipient_kind from chat_notification_targets where label in ('CH7 local owner','CH7 local staff')",
    )
  ).rows;
  assert.equal(targets.length, 2);
  assert.ok(targets.every((x) => x.tenant_id === t && x.recipient_enc));
  assert.equal(targets.filter((x) => x.is_active).length, 1);
  checks.push(
    "Synthetic notification recipients encrypted and tenantA-only; only owner target active",
  );
  const response = await fetch(
    "http://localhost:4131/track/dxb60Q537C-SZ7R8qGI_WRfnwQHwrIM2",
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const secret of [
    "QA prepare",
    "QA finish",
    "Synthetic QA worker",
    "edit verified",
    "CH6-SYNTHETIC-LOCAL",
    "ch6-qa@example.invalid",
  ])
    assert.ok(!html.includes(secret));
  checks.push(
    "Anonymous HTTP200 public tracking excludes internal stage, worker, notes, receipt reference and email",
  );
  const expected = [
    {
      name: "20261027120000_chat_notification_state.sql",
      sha256:
        "bbd71c5946f431d4c14500340d373b2757566ea481e8700bd908d72b045c5a5e",
    },
    {
      name: "20261027121000_chat_notification_commands.sql",
      sha256:
        "893f6ed4d87d15e90b9d1a6ec2ccee42bb91569f20167f22ae9a544c0983d88b",
    },
    {
      name: "20261027122000_chat_notification_summary.sql",
      sha256:
        "5352de4c702970c683bb56069f81f4c131481866df6939bfd5f00df1dbb53108",
    },
    {
      name: "20261027123000_chat_notification_dispatch.sql",
      sha256:
        "40a58be80507ec561fc0830a2f33ab240194d2c920f22a9d1b45245ab9831cd5",
    },
    {
      name: "20261027124000_chat_platform_alert_attempts.sql",
      sha256:
        "d312c60fb76731afd14018b8f4fad31e94ee1464b97963abff974fe5302db95d",
    },
  ];
  for (const h of expected) {
    const bytes = await readFile(
      path.join(root, "supabase/migrations", h.name),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), h.sha256);
  }
  checks.push("All five applied CH7 migration hashes unchanged");
  const template = JSON.parse(
    await readFile(path.join(root, "deploy/n8n/chat-hourly.json"), "utf8"),
  );
  assert.equal(template.active, false);
  assert.ok(!JSON.stringify(template).includes("api.telegram.org"));
  checks.push(
    "n8n template parses and remains inactive; no runtime/import/activation claim",
  );
  const snapshot = path.join(runtime, "app-1793114149945"),
    file = "src/features/chat/notifications/engine.ts";
  await copyFile(path.join(root, file), path.join(snapshot, file));
  await appendFile(
    path.join(runtime, "ch7-snapshot-patches.jsonl"),
    JSON.stringify({
      at: new Date().toISOString(),
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex"),
      reason: "Final paused-transport guard alignment",
    }) + "\n",
  );
  const report = {
    at: new Date().toISOString(),
    result: "PASS",
    checks,
    scope:
      "Read-only owned-local SQL and anonymous HTTP; no new Boutique mutations, real Telegram or paid model calls",
  };
  await writeFile(
    path.join(runtime, "ch7-final-assert-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("PASS " + checks.length + "/" + checks.length);
} finally {
  await db.end();
}
