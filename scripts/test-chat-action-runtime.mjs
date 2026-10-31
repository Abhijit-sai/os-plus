import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local;
const fixtures = [];
const pack = JSON.parse(
  readFileSync(
    new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
    "utf8",
  ),
);
const ctx = (tenantId, who = "owner", key = randomUUID()) => ({
  tenantId,
  actor: { type: "USER", id: "action-" + who },
  source: "OS_PLUS_UI",
  correlationId: "action-runtime",
  idempotencyKey: key,
});
const run = (f, action, input, context = ctx(f.tenantId), db = local.db) =>
  db
    .query("select chat_action_command($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
before(
  async () => {
    local = await startChatDatabase();
    for (let i = 0; i < 2; i++) {
      const tenantId = randomUUID();
      await local.db.query(
        "insert into tenants(id,name,store_name,slug) values($1,'Action QA','Action QA',$2)",
        [tenantId, "action-" + i],
      );
      await local.db.query(
        "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
        [tenantId],
      );
      await local.db.query("insert into chat_settings(tenant_id) values($1)", [
        tenantId,
      ]);
      for (const [who, role] of [
        ["owner", "owner_admin"],
        ["manager", "manager"],
        ["viewer", "viewer"],
        ["finance", "finance"],
      ])
        await local.db.query(
          "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')",
          [tenantId, "action-" + who, who + "@example.invalid", who, role],
        );
      const brandId = (
        await local.db.query(
          "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Action Brand','action','Demo') returning id",
          [tenantId],
        )
      ).rows[0].id;
      const workspaceId = (
        await local.db.query(
          "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',$2,$3,$4,'gcm1.v1.fixture','active') returning id",
          [tenantId, 901 + i, String(i).repeat(32), "a".repeat(64)],
        )
      ).rows[0].id;
      const channelId = (
        await local.db.query(
          "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name,can_book) values($1,$2,$3,20,'whatsapp','Synthetic',true) returning id",
          [tenantId, workspaceId, brandId],
        )
      ).rows[0].id;
      const actionPack = {
        ...pack,
        services: [
          ...pack.services,
          { key: "synthetic_support", name: "Synthetic support", aliases: [] },
        ],
        booking: { capability: "follow_up_task" },
      };
      await local.db.query(
        "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,1,'published',$3)",
        [tenantId, brandId, JSON.stringify(actionPack)],
      );
      const captured = (
        await local.db.query(
          "select chat_capture($1::jsonb,'agent',$2::jsonb) result",
          [
            JSON.stringify({
              tenantId,
              actor: { type: "WEBHOOK", id: "chatwoot" },
              source: "WEBHOOK",
              correlationId: "action-fixture",
            }),
            JSON.stringify({
              workspaceId,
              secretHash: "a".repeat(64),
              channelId,
              identity: {
                displayName: "Synthetic customer",
                sourceId: "91999999000" + i,
                phoneE164: "+91999999000" + i,
              },
              message: {
                messageId: 10,
                accountId: 901 + i,
                inboxId: 20,
                conversationId: 10,
                contactId: 10,
                status: "open",
                channelKind: "whatsapp",
                author: "customer",
                private: false,
                content: "Please arrange a callback about general information.",
                contentType: "text",
                attachments: [],
                staffUserId: null,
                createdAt: new Date().toISOString(),
              },
            }),
          ],
        )
      ).rows[0].result;
      const lead = (
        await local.db.query(
          "select * from leads where tenant_id=$1 and conversation_id=$2",
          [tenantId, captured.conversationId],
        )
      ).rows[0];
      fixtures.push({
        tenantId,
        brandId,
        workspaceId,
        channelId,
        leadId: lead.id,
        contactId: lead.contact_id,
        conversationId: captured.conversationId,
        messageId: captured.messageId,
      });
    }
  },
  { timeout: 120000 },
);
after(async () => local?.stop(), { timeout: 30000 });
const details = {
  name: null,
  services: ["general_inquiry"],
  area: null,
  address: null,
  date: null,
  window: null,
  timePreference: null,
};
const proposal = (f) => ({
  leadId: f.leadId,
  capability: "follow_up_task",
  sourceMessageId: f.messageId,
  evidence: "Please arrange a callback",
  details,
});
test("staff can save one audited provisional request and replay it without creating a customer, task or booking", async () => {
  const f = fixtures[0],
    context = ctx(f.tenantId),
    input = proposal(f);
  const result = await run(f, "request.save", input, context);
  assert.equal(result.status, "requested");
  assert.equal(result.version, 1);
  assert.deepEqual(await run(f, "request.save", input, context), result);
  const stored = (
    await local.db.query(
      "select * from chat_action_requests where tenant_id=$1 and id=$2",
      [f.tenantId, result.id],
    )
  ).rows[0];
  assert.equal(stored.confirmed_revision, null);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from customers where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    "0",
  );
  assert.equal(
    (
      await local.db.query("select count(*) n from tasks where tenant_id=$1", [
        f.tenantId,
      ])
    ).rows[0].n,
    "0",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from lead_events where tenant_id=$1 and kind='request.saved'",
        [f.tenantId],
      )
    ).rows[0].n,
    "1",
  );
});

test("request commands deny foreign data, quotes, revoked roles and changed retry payloads without partial writes", async () => {
  const [a, b] = fixtures;
  const count = async () =>
    Number(
      (await local.db.query("select count(*) n from chat_action_requests"))
        .rows[0].n,
    );
  const before = await count();
  for (const who of ["viewer", "finance", "missing"])
    await assert.rejects(
      run(a, "request.save", proposal(a), ctx(a.tenantId, who)),
      /access denied/,
    );
  await assert.rejects(
    run(a, "request.save", { ...proposal(a), leadId: b.leadId }),
    /unavailable/,
  );
  await assert.rejects(
    run(a, "request.save", { ...proposal(a), sourceMessageId: b.messageId }),
    /evidence/,
  );
  await assert.rejects(
    run(a, "request.save", { ...proposal(a), evidence: "Invented consent" }),
    /evidence/,
  );
  await assert.rejects(
    run(a, "request.save", {
      ...proposal(a),
      details: { ...details, services: ["unknown"] },
    }),
    /service/,
  );
  await assert.rejects(
    run(a, "request.save", {
      ...proposal(a),
      details: { ...details, createCustomer: true },
    }),
    /details/,
  );
  const context = ctx(a.tenantId);
  await run(a, "request.save", proposal(a), context);
  await assert.rejects(
    run(a, "request.save", { ...proposal(a), evidence: "callback" }, context),
    /conflict/,
  );
  assert.equal(await count(), before);
  const client = await local.connect();
  await client.query("set role authenticated");
  await assert.rejects(
    client.query("select * from chat_action_requests"),
    /permission denied/,
  );
  await assert.rejects(
    client.query("select chat_action_command($1,'request.save',$2)", [
      JSON.stringify(ctx(a.tenantId)),
      JSON.stringify(proposal(a)),
    ]),
    /permission denied/,
  );
  await client.query("reset role");
});
test("concurrent identical requests share a draft; ordering does not duplicate services and different details stay separate", async () => {
  const f = fixtures[1],
    other = await local.connect();
  const [first, second] = await Promise.all([
    run(f, "request.save", proposal(f)),
    run(f, "request.save", proposal(f), ctx(f.tenantId, "manager"), other),
  ]);
  assert.equal(first.id, second.id);
  assert.notEqual(first.duplicate, second.duplicate);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_action_requests where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    "1",
  );
  const distinct = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, area: "Another synthetic area" },
  });
  assert.notEqual(distinct.id, first.id);
  const changedTime = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, timePreference: "Synthetic later preference" },
  });
  assert.notEqual(changedTime.id, first.id);
  const pair = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, services: ["general_inquiry", "synthetic_support"] },
  });
  const reversed = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, services: ["synthetic_support", "general_inquiry"] },
  });
  assert.equal(pair.id, reversed.id);
});

test("revising and withdrawing pending requests uses fresh versions; failed writes roll back audit and receipts", async () => {
  const f = fixtures[0],
    saved = await run(f, "request.save", proposal(f));
  const before = (
    await local.db.query(
      "select count(*) n from lead_events where tenant_id=$1",
      [f.tenantId],
    )
  ).rows[0].n;
  await assert.rejects(
    run(f, "request.revise", {
      id: saved.id,
      version: 99,
      details: { ...details, timePreference: "Tomorrow afternoon" },
      sourceMessageId: f.messageId,
      evidence: "callback",
    }),
    /changed/,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from lead_events where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    before,
  );
  const revised = await run(f, "request.revise", {
    id: saved.id,
    version: saved.version,
    details: { ...details, timePreference: "Tomorrow afternoon" },
    sourceMessageId: f.messageId,
    evidence: "callback",
  });
  assert.equal(revised.version, 2);
  assert.equal(
    (
      await local.db.query(
        "select revision from chat_action_requests where id=$1",
        [saved.id],
      )
    ).rows[0].revision,
    2,
  );
  await assert.rejects(
    run(f, "request.withdraw", { id: saved.id, version: 1 }),
    /changed/,
  );
  const cancelled = await run(f, "request.withdraw", {
    id: saved.id,
    version: 2,
  });
  assert.equal(cancelled.status, "withdrawn");
  await assert.rejects(
    run(f, "request.revise", {
      id: saved.id,
      version: 3,
      details,
      sourceMessageId: f.messageId,
      evidence: "callback",
    }),
    /withdrawn/,
  );
  assert.equal(
    (
      await local.db.query("select count(*) n from tasks where tenant_id=$1", [
        f.tenantId,
      ])
    ).rows[0].n,
    "0",
  );
});

test("a handoff creates one real task, merges reasons and preserves the existing Laundry task boundary", async () => {
  const f = fixtures[0],
    context = ctx(f.tenantId);
  const input = {
    leadId: f.leadId,
    reason: "dues",
    messageId: f.messageId,
    assigneeChatwootId: null,
  };
  const task = await local.db.query(
    "select chat_task_command($1::jsonb,'handoff',$2::jsonb) result",
    [JSON.stringify(context), JSON.stringify(input)],
  );
  const result = task.rows[0].result;
  assert.ok(result.taskId);
  assert.equal(result.route, "unassigned");
  const again = (
    await local.db.query(
      "select chat_task_command($1::jsonb,'handoff',$2::jsonb) result",
      [
        JSON.stringify(ctx(f.tenantId, "manager")),
        JSON.stringify({ ...input, reason: "staff_requested" }),
      ],
    )
  ).rows[0].result;
  assert.equal(again.taskId, result.taskId);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_task_reasons where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    "2",
  );
  const actual = (
    await local.db.query("select * from tasks where tenant_id=$1 and id=$2", [
      f.tenantId,
      result.taskId,
    ])
  ).rows[0];
  assert.equal(actual.task_type, "CHAT_HANDOFF");
  assert.equal(actual.subject_type, "lead");
  assert.equal(actual.subject_id, f.leadId);
  assert.equal(
    (
      await local.db.query(
        "select handoff from leads where tenant_id=$1 and id=$2",
        [f.tenantId, f.leadId],
      )
    ).rows[0].handoff,
    true,
  );
});

test("only eligible staff can work Chat tasks; completed work allows a new handoff and foreign tasks never change", async () => {
  const f = fixtures[0],
    other = fixtures[1];
  const taskCall = (action, input, context = ctx(f.tenantId)) =>
    local.db
      .query("select chat_task_command($1::jsonb,$2,$3::jsonb) result", [
        JSON.stringify(context),
        action,
        JSON.stringify(input),
      ])
      .then((r) => r.rows[0].result);
  const rec = (
    await local.db.query(
      "select * from chat_task_records where tenant_id=$1 and closed_at is null",
      [f.tenantId],
    )
  ).rows[0];
  const manager = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='manager'",
      [f.tenantId],
    )
  ).rows[0].id;
  const viewer = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='viewer'",
      [f.tenantId],
    )
  ).rows[0].id;
  const foreign = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='manager'",
      [other.tenantId],
    )
  ).rows[0].id;
  for (const userId of [viewer, foreign])
    await assert.rejects(
      taskCall("assign", {
        id: rec.id,
        version: rec.version,
        userId,
        teamId: null,
      }),
      /eligible/,
    );
  const assigned = await taskCall("assign", {
    id: rec.id,
    version: rec.version,
    userId: manager,
    teamId: null,
  });
  assert.equal(
    (
      await local.db.query("select assigned_user_id from tasks where id=$1", [
        rec.task_id,
      ])
    ).rows[0].assigned_user_id,
    manager,
  );
  await assert.rejects(
    taskCall(
      "complete",
      { id: rec.id, version: assigned.version },
      ctx(f.tenantId, "viewer"),
    ),
    /access denied/,
  );
  await assert.rejects(
    taskCall(
      "complete",
      { id: rec.id, version: assigned.version },
      ctx(other.tenantId),
    ),
    /changed/,
  );
  await taskCall("complete", { id: rec.id, version: assigned.version });
  assert.equal(
    (
      await local.db.query("select status from tasks where id=$1", [
        rec.task_id,
      ])
    ).rows[0].status,
    "COMPLETED",
  );
  const next = await taskCall("handoff", {
    leadId: f.leadId,
    reason: "complaint",
    messageId: f.messageId,
    assigneeChatwootId: null,
  });
  assert.notEqual(next.taskId, rec.task_id);
});

test("actual task routing prefers mapped eligible staff, then lead owner, then the configured active team", async () => {
  const f = fixtures[1];
  const users = (
    await local.db.query(
      "select id,role from tenant_users where tenant_id=$1",
      [f.tenantId],
    )
  ).rows;
  const owner = users.find((u) => u.role === "owner_admin").id,
    manager = users.find((u) => u.role === "manager").id;
  const team = (
    await local.db.query(
      "insert into teams(tenant_id,name,code) values($1,'Synthetic service team','action-team') returning id",
      [f.tenantId],
    )
  ).rows[0].id;
  const branch = (
    await local.db.query(
      "insert into tenant_locations(tenant_id,code,name) values($1,'routed','Routed synthetic branch') returning id",
      [f.tenantId],
    )
  ).rows[0].id;
  await local.db.query(
    "insert into chat_brand_locations(tenant_id,brand_id,location_id) values($1,$2,$3)",
    [f.tenantId, f.brandId, branch],
  );
  await local.db.query(
    "update leads set location_id=$2 where tenant_id=$1 and id=$3",
    [f.tenantId, branch, f.leadId],
  );
  await local.db.query(
    "insert into chat_action_routes(tenant_id,channel_id,location_id,team_id) values($1,$2,$3,$4)",
    [f.tenantId, f.channelId, branch, team],
  );
  await local.db.query(
    "update leads set owner_tenant_user_id=$2 where tenant_id=$1 and id=$3",
    [f.tenantId, owner, f.leadId],
  );
  await local.db.query(
    "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,33)",
    [f.tenantId, manager],
  );
  const call = async (action, input) =>
    (
      await local.db.query(
        "select chat_task_command($1::jsonb,$2,$3::jsonb) result",
        [JSON.stringify(ctx(f.tenantId)), action, JSON.stringify(input)],
      )
    ).rows[0].result;
  const input = {
    leadId: f.leadId,
    reason: "staff_requested",
    messageId: f.messageId,
    assigneeChatwootId: 33,
  };
  let handoff = await call("handoff", input);
  assert.equal(handoff.route, "chatwoot");
  await call("complete", { id: handoff.id, version: handoff.version });
  await local.db.query(
    "update tenant_users set status='disabled' where tenant_id=$1 and id=$2",
    [f.tenantId, manager],
  );
  handoff = await call("handoff", input);
  assert.equal(handoff.route, "lead");
  await call("complete", { id: handoff.id, version: handoff.version });
  await local.db.query(
    "update leads set owner_tenant_user_id=null where tenant_id=$1 and id=$2",
    [f.tenantId, f.leadId],
  );
  handoff = await call("handoff", input);
  assert.equal(handoff.route, "team");
  await call("complete", { id: handoff.id, version: handoff.version });
  const unrelatedLocation = (
    await local.db.query(
      "insert into tenant_locations(tenant_id,code,name) values($1,'unmapped','Unmapped synthetic branch') returning id",
      [f.tenantId],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set location_id=$2 where tenant_id=$1 and id=$3",
    [f.tenantId, unrelatedLocation, f.leadId],
  );
  const unresolved = await call("handoff", input);
  assert.equal(
    unresolved.route,
    "unassigned",
    "A different/unmapped branch must not inherit a channel team.",
  );
  await call("complete", { id: unresolved.id, version: unresolved.version });
  await local.db.query(
    "update leads set location_id=$3 where tenant_id=$1 and id=$2",
    [f.tenantId, f.leadId, branch],
  );
  await local.db.query(
    "update teams set is_active=false where tenant_id=$1 and id=$2",
    [f.tenantId, team],
  );
  handoff = await call("handoff", input);
  assert.equal(handoff.route, "unassigned");
  await call("complete", { id: handoff.id, version: handoff.version });
});
test("an audit failure rolls back the real task, reason, lead flag and nested idempotency receipt", async () => {
  const f = fixtures[1],
    key = randomUUID(),
    before = (
      await local.db.query("select count(*) n from tasks where tenant_id=$1", [
        f.tenantId,
      ])
    ).rows[0].n;
  await local.db.query(
    "create function qa_reject_handoff() returns trigger language plpgsql as $$ begin if new.kind='handoff.recorded' then raise exception 'Synthetic audit outage'; end if;return new;end $$; create trigger qa_reject_handoff before insert on lead_events for each row execute function qa_reject_handoff()",
  );
  try {
    await assert.rejects(runTask(), /Synthetic audit outage/);
    assert.equal(
      (
        await local.db.query(
          "select count(*) n from tasks where tenant_id=$1",
          [f.tenantId],
        )
      ).rows[0].n,
      before,
    );
    assert.equal(
      (
        await local.db.query(
          "select handoff from leads where tenant_id=$1 and id=$2",
          [f.tenantId, f.leadId],
        )
      ).rows[0].handoff,
      false,
    );
    assert.equal(
      (
        await local.db.query(
          "select count(*) n from command_idempotency where tenant_id=$1 and idempotency_key=$2",
          [f.tenantId, key],
        )
      ).rows[0].n,
      "0",
    );
  } finally {
    await local.db.query(
      "drop trigger qa_reject_handoff on lead_events;drop function qa_reject_handoff()",
    );
  }
  const retry = await runTask();
  assert.ok(retry.taskId);
  async function runTask() {
    return (
      await local.db.query(
        "select chat_task_command($1::jsonb,'handoff',$2::jsonb) result",
        [
          JSON.stringify(ctx(f.tenantId, "owner", key)),
          JSON.stringify({
            leadId: f.leadId,
            messageId: f.messageId,
            reason: "dues",
            assigneeChatwootId: null,
          }),
        ],
      )
    ).rows[0].result;
  }
});

test("capability-aware publication accepts callback packs and rejects disabled Laundry without replacing the active pack", async () => {
  const f = fixtures[0];
  const draft = (
    await local.db.query(
      "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,2,'draft',$3) returning id",
      [
        f.tenantId,
        f.brandId,
        JSON.stringify({ ...pack, booking: { capability: "follow_up_task" } }),
      ],
    )
  ).rows[0].id;
  const input = { id: draft },
    context = ctx(f.tenantId);
  const publish = async (input, context) =>
    (
      await local.db.query(
        "select chat_publish_action_pack($1::jsonb,$2::jsonb) result",
        [JSON.stringify(context), JSON.stringify(input)],
      )
    ).rows[0].result;
  await assert.rejects(
    publish(input, ctx(f.tenantId, "manager")),
    /access denied/i,
  );
  const result = await publish(input, context);
  assert.equal(result.id, draft);
  assert.deepEqual(await publish(input, context), result);
  const bad = (
    await local.db.query(
      "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,3,'draft',$3) returning id",
      [
        f.tenantId,
        f.brandId,
        JSON.stringify({ ...pack, booking: { capability: "laundry_pickup" } }),
      ],
    )
  ).rows[0].id;
  await assert.rejects(
    publish({ id: bad }, ctx(f.tenantId)),
    /LAUNDRY_VERTICAL_NOT_ENABLED/,
  );
  assert.equal(
    (
      await local.db.query(
        "select id from chat_knowledge_packs where tenant_id=$1 and status='published'",
        [f.tenantId],
      )
    ).rows[0].id,
    draft,
  );
});

test("request and task reads are current-tenant staff-only, and revocation blocks completed-command replay", async () => {
  const f = fixtures[0],
    foreign = fixtures[1],
    context = ctx(f.tenantId),
    input = proposal(f);
  await run(f, "request.save", input, context);
  const read = async (t, leadId, who = "owner") =>
    (
      await local.db.query(
        "select chat_action_read($1::jsonb,$2::jsonb) result",
        [JSON.stringify(ctx(t, who)), JSON.stringify({ leadId })],
      )
    ).rows[0].result;
  const view = await read(f.tenantId, f.leadId);
  assert.ok(view.requests.length);
  assert.ok(view.tasks.length);
  assert.equal(
    view.requests.every((r) => r.leadId === f.leadId),
    true,
  );
  for (const who of ["viewer", "finance"])
    await assert.rejects(read(f.tenantId, f.leadId, who), /access denied/);
  await assert.rejects(read(f.tenantId, foreign.leadId), /unavailable/);
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [f.tenantId],
  );
  try {
    await assert.rejects(
      run(f, "request.save", input, context),
      /access denied/,
    );
    await assert.rejects(read(f.tenantId, f.leadId), /access denied/);
  } finally {
    await local.db.query(
      "update tenant_modules set is_enabled=true where tenant_id=$1",
      [f.tenantId],
    );
  }
});

const confirmation = {
  intro: "Please confirm this request; the team will review availability.",
  labels: {
    name: "Name",
    services: "Services",
    address: "Address",
    date: "Date",
    window: "Window",
    timePreference: "Preferred contact time",
  },
  phrases: ["yes", "confirmed"],
};
async function installBookingPack(f, capability = "follow_up_task") {
  const body = {
    ...pack,
    booking: {
      capability,
      windows: [{ key: "morning", label: "Synthetic morning window" }],
      confirmation,
    },
  };
  await local.db.query(
    "update chat_knowledge_packs set status='archived' where tenant_id=$1 and brand_id=$2 and status='published'",
    [f.tenantId, f.brandId],
  );
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) select $1,$2,coalesce(max(version),0)+1,'published',$3 from chat_knowledge_packs where tenant_id=$1 and brand_id=$2",
    [f.tenantId, f.brandId, JSON.stringify(body)],
  );
}
async function publicMessage(f, content, author = "customer") {
  return (
    await local.db.query(
      "insert into chat_messages(tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,staff_chatwoot_user_id,created_at) values($1,$2,(select coalesce(max(chatwoot_message_id),0)+1 from chat_messages where tenant_id=$1),$3,false,$4,'text',case when $3='staff' then 1 else null end,clock_timestamp()) returning id",
      [f.tenantId, f.conversationId, author, content],
    )
  ).rows[0].id;
}
const workflow = (f, action, input, context = ctx(f.tenantId), db = local.db) =>
  db
    .query("select chat_request_workflow($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("a current public summary and exact later customer confirmation precede a separate idempotent staff callback approval", async () => {
  const f = fixtures[0];
  await installBookingPack(f);
  const saved = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, area: "Workflow synthetic area" },
  });
  await assert.rejects(
    workflow(f, "approve", {
      id: saved.id,
      version: saved.version,
      countryCode: null,
    }),
    /confirmation/,
  );
  const reviewed = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  assert.match(reviewed.reviewText, /General inquiry/);
  const yesBefore = await publicMessage(f, "yes");
  await assert.rejects(
    workflow(f, "confirm", {
      id: saved.id,
      version: reviewed.version,
      messageId: yesBefore,
    }),
    /summary/,
  );
  await publicMessage(f, reviewed.reviewText, "staff");
  const yes = await publicMessage(f, "yes");
  const confirmed = await workflow(f, "confirm", {
    id: saved.id,
    version: reviewed.version,
    messageId: yes,
  });
  assert.equal(confirmed.status, "customer_confirmed");
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from tasks where tenant_id=$1 and task_type='LEAD_FOLLOW_UP'",
        [f.tenantId],
      )
    ).rows[0].n,
    "0",
  );
  await assert.rejects(
    workflow(
      f,
      "approve",
      { id: saved.id, version: confirmed.version, countryCode: null },
      ctx(f.tenantId, "viewer"),
    ),
    /access denied/,
  );
  const context = ctx(f.tenantId),
    input = { id: saved.id, version: confirmed.version, countryCode: null };
  const approved = await workflow(f, "approve", input, context);
  assert.equal(approved.status, "materialized");
  assert.ok(approved.taskId);
  assert.deepEqual(await workflow(f, "approve", input, context), approved);
  assert.equal(
    (
      await local.db.query(
        "select stage from leads where tenant_id=$1 and id=$2",
        [f.tenantId, f.leadId],
      )
    ).rows[0].stage,
    "new",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from customers where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    "0",
  );
});

test("Laundry approval atomically uses native customer/pickup/task rules and operational changes only create a handoff", async () => {
  const f = fixtures[1];
  await local.db.query(
    "insert into tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at) select $1,id,true,now() from vertical_definitions where key='laundry' on conflict(tenant_id,vertical_definition_id) do update set is_enabled=true",
    [f.tenantId],
  );
  await installBookingPack(f, "laundry_pickup");
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const input = {
    ...proposal(f),
    capability: "laundry_pickup",
    details: {
      ...details,
      name: "Synthetic Pickup Person",
      area: "Workflow Laundry",
      address: "Synthetic confirmed address",
      date,
      window: "morning",
    },
  };
  const saved = await run(f, "request.save", input);
  const reviewed = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  await publicMessage(f, reviewed.reviewText, "staff");
  const yes = await publicMessage(f, "confirmed");
  const confirmed = await workflow(f, "confirm", {
    id: saved.id,
    version: reviewed.version,
    messageId: yes,
  });
  const approved = await workflow(f, "approve", {
    id: saved.id,
    version: confirmed.version,
    countryCode: "IN",
  });
  assert.equal(approved.status, "materialized");
  assert.ok(approved.pickupId);
  const pickup = (
    await local.db.query(
      "select * from laundry_pickup_requests where tenant_id=$1 and id=$2",
      [f.tenantId, approved.pickupId],
    )
  ).rows[0];
  assert.equal(pickup.status, "NEW");
  assert.equal(pickup.notes, "General inquiry");
  assert.ok(pickup.pickup_address_id);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from tasks where tenant_id=$1 and task_type='PICKUP'",
        [f.tenantId],
      )
    ).rows[0].n,
    "1",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from tasks where tenant_id=$1 and task_type='LEAD_FOLLOW_UP'",
        [f.tenantId],
      )
    ).rows[0].n,
    "0",
  );
  assert.equal(
    (
      await local.db.query(
        "select booking_pickup_id from leads where tenant_id=$1 and id=$2",
        [f.tenantId, f.leadId],
      )
    ).rows[0].booking_pickup_id,
    approved.pickupId,
  );
  const changeMessage = await publicMessage(
    f,
    "Please cancel this pickup request.",
  );
  await workflow(f, "change", {
    id: saved.id,
    version: approved.version,
    messageId: changeMessage,
  });
  assert.equal(
    (
      await local.db.query(
        "select status from laundry_pickup_requests where tenant_id=$1 and id=$2",
        [f.tenantId, approved.pickupId],
      )
    ).rows[0].status,
    "NEW",
  );
});

test("a new customer message invalidates approval, and a detail revision removes confirmation and its public-summary receipt", async () => {
  const f = fixtures[0],
    saved = await run(f, "request.save", {
      ...proposal(f),
      details: { ...details, area: "Stale confirmation synthetic" },
    });
  const reviewed = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  await publicMessage(f, reviewed.reviewText, "staff");
  const messageId = await publicMessage(f, "yes"),
    confirmed = await workflow(f, "confirm", {
      id: saved.id,
      version: reviewed.version,
      messageId,
    });
  await publicMessage(f, "Please wait, I need to change it.");
  await assert.rejects(
    workflow(f, "approve", {
      id: saved.id,
      version: confirmed.version,
      countryCode: null,
    }),
    /confirmation changed/,
  );
  const revised = await run(f, "request.revise", {
    id: saved.id,
    version: confirmed.version,
    details: { ...details, area: "Updated customer request" },
    sourceMessageId: f.messageId,
    evidence: "callback",
  });
  assert.equal(revised.status, "requested");
  const row = (
    await local.db.query(
      "select confirmed_revision,summary_message_id,review_text from chat_action_requests where id=$1",
      [saved.id],
    )
  ).rows[0];
  assert.deepEqual(row, {
    confirmed_revision: null,
    summary_message_id: null,
    review_text: null,
  });
});
test("a failed Laundry approval rolls back customer creation and remains safely retryable", async () => {
  const parent = fixtures[1],
    phone = "+919999991234";
  const captured = (
    await local.db.query("select chat_capture($1,'agent',$2) result", [
      JSON.stringify({
        tenantId: parent.tenantId,
        actor: { type: "WEBHOOK", id: "chatwoot" },
        source: "WEBHOOK",
        correlationId: "rollback-fixture",
      }),
      JSON.stringify({
        workspaceId: parent.workspaceId,
        secretHash: "a".repeat(64),
        channelId: parent.channelId,
        identity: {
          displayName: "Synthetic rollback",
          sourceId: phone.slice(1),
          phoneE164: phone,
        },
        message: {
          messageId: 1000,
          accountId: 902,
          inboxId: 20,
          conversationId: 1000,
          contactId: 1000,
          status: "open",
          channelKind: "whatsapp",
          author: "customer",
          private: false,
          content: "Please arrange a callback",
          contentType: "text",
          attachments: [],
          staffUserId: null,
          createdAt: new Date().toISOString(),
        },
      }),
    ])
  ).rows[0].result;
  const lead = (
    await local.db.query(
      "select id,contact_id from leads where tenant_id=$1 and conversation_id=$2",
      [parent.tenantId, captured.conversationId],
    )
  ).rows[0];
  const f = {
    ...parent,
    leadId: lead.id,
    contactId: lead.contact_id,
    conversationId: captured.conversationId,
    messageId: captured.messageId,
  };
  const saved = await run(f, "request.save", {
    ...proposal(f),
    capability: "laundry_pickup",
    details: {
      ...details,
      name: "Synthetic rollback",
      address: "Synthetic rollback address",
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      window: "morning",
    },
  });
  const review = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  await publicMessage(f, review.reviewText, "staff");
  const yes = await publicMessage(f, "yes");
  const confirmed = await workflow(f, "confirm", {
    id: saved.id,
    version: review.version,
    messageId: yes,
  });
  const before = (
    await local.db.query(
      "select count(*) n from customers where tenant_id=$1",
      [f.tenantId],
    )
  ).rows[0].n;
  const context = ctx(f.tenantId),
    input = { id: saved.id, version: confirmed.version, countryCode: null };
  await assert.rejects(workflow(f, "approve", input, context), /country/);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from customers where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    before,
  );
  assert.equal(
    (
      await local.db.query(
        "select customer_id from chat_contacts where id=$1",
        [f.contactId],
      )
    ).rows[0].customer_id,
    null,
  );
  const approved = await workflow(
    f,
    "approve",
    { ...input, countryCode: "IN" },
    context,
  );
  assert.ok(approved.pickupId);
  const { actionViewSchema } =
    await import("../src/features/chat/actions/view-schemas.ts");
  const result = (
    await local.db.query("select chat_action_read($1,$2) result", [
      JSON.stringify(ctx(f.tenantId)),
      JSON.stringify({ leadId: f.leadId }),
    ])
  ).rows[0].result;
  assert.equal(
    actionViewSchema.parse(result).requests[0].status,
    "materialized",
  );
});

test("captured mock booking completion atomically saves a provisional request and one staff handoff, never an operational booking", async () => {
  const f = fixtures[0],
    context = {
      tenantId: f.tenantId,
      actor: { type: "WEBHOOK", id: "chatwoot" },
      source: "WEBHOOK",
      correlationId: "action-agent",
    };
  await local.db.query(
    "update tenant_modules set config_json=config_json||'{\"agentEnabled\":true}' where tenant_id=$1",
    [f.tenantId],
  );
  const captured = (
    await local.db.query("select chat_capture($1,'agent',$2) result", [
      JSON.stringify(context),
      JSON.stringify({
        workspaceId: f.workspaceId,
        secretHash: "a".repeat(64),
        channelId: f.channelId,
        identity: {
          displayName: "Synthetic customer",
          sourceId: "919999990000",
          phoneE164: "+919999990000",
        },
        message: {
          messageId: 2000,
          accountId: 901,
          inboxId: 20,
          conversationId: 10,
          contactId: 10,
          status: "open",
          channelKind: "whatsapp",
          author: "customer",
          private: false,
          content: "CH6 synthetic booking: General inquiry",
          contentType: "text",
          attachments: [],
          staffUserId: null,
          createdAt: new Date().toISOString(),
        },
      }),
    ])
  ).rows[0].result;
  const input = {
    workspaceId: f.workspaceId,
    secretHash: "a".repeat(64),
    channelId: f.channelId,
    conversationId: captured.conversationId,
    triggerMessageId: captured.messageId,
  };
  const call = async (action, extra = {}) =>
    (
      await local.db.query("select chat_action_agent_run($1,$2,$3) result", [
        JSON.stringify(context),
        action,
        JSON.stringify({ ...input, ...extra }),
      ])
    ).rows[0].result;
  const claim = await call("claim");
  const { runAgentTurn } = await import("../src/features/chat/agent/turn.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  const result = await runAgentTurn(
    {
      scope: {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        channelId: f.channelId,
        conversationId: captured.conversationId,
        triggerMessageId: captured.messageId,
      },
      data: claim.context,
      now: new Date().toISOString(),
    },
    createMockModel("booking", claim.context.pack.body),
  );
  const lease = { runId: claim.runId, leaseToken: claim.leaseToken, result };
  await call("complete", lease);
  await call("complete", lease);
  const requests = (
    await local.db.query(
      "select * from chat_action_requests where tenant_id=$1 and source_message_id=$2",
      [f.tenantId, captured.messageId],
    )
  ).rows;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].status, "requested");
  assert.equal(requests[0].task_id, null);
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_task_records where tenant_id=$1 and lead_id=$2 and work_kind='CHAT_HANDOFF' and closed_at is null",
        [f.tenantId, f.leadId],
      )
    ).rows[0].n,
    "1",
  );
});

test("automatic public delivery needs current owner signoff; uncertain claims are held and cannot be resent", async () => {
  const f = fixtures[0],
    run = (
      await local.db.query(
        "select * from chat_agent_runs where tenant_id=$1 order by created_at desc limit 1",
        [f.tenantId],
      )
    ).rows[0];
  const input = {
    workspaceId: f.workspaceId,
    secretHash: "a".repeat(64),
    channelId: f.channelId,
    conversationId: run.conversation_id,
    triggerMessageId: run.trigger_message_id,
    runId: run.id,
    leaseToken: run.lease_token,
  };
  const context = {
    tenantId: f.tenantId,
    actor: { type: "WEBHOOK", id: "chatwoot" },
    source: "WEBHOOK",
    correlationId: "public-fence",
  };
  const pub = async (action, extra = {}) =>
    (
      await local.db.query("select chat_public_reply($1,$2,$3) result", [
        JSON.stringify(context),
        action,
        JSON.stringify({ ...input, ...extra }),
      ])
    ).rows[0].result;
  assert.equal((await pub("claim")).status, "private");
  const packId = (
    await local.db.query(
      "select id from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 and status='published'",
      [f.tenantId, f.brandId],
    )
  ).rows[0].id;
  const settings = {
    channelId: f.channelId,
    version: 0,
    mode: "auto",
    canBook: true,
    packId,
    approveAuto: true,
    locationId: null,
    teamId: null,
  };
  const config = async (body, who = "owner") =>
    (
      await local.db.query("select chat_action_configure($1,$2) result", [
        JSON.stringify(ctx(f.tenantId, who)),
        JSON.stringify(body),
      ])
    ).rows[0].result;
  await assert.rejects(config(settings, "manager"), /Owner/);
  await assert.rejects(config({ ...settings, approveAuto: false }), /approve/);
  await config(settings);
  const claimed = await pub("claim");
  assert.equal(claimed.status, "claimed");
  assert.ok(claimed.replyText);
  assert.equal((await pub("claim")).status, "held");
  assert.ok((await pub("target")).accountId);
  await config({ ...settings, version: 1, mode: "draft", approveAuto: false });
  await assert.rejects(pub("target"), /approval/);
  await pub("uncertain");
  assert.equal((await pub("claim")).status, "uncertain");
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_public_outbox where tenant_id=$1 and run_id=$2",
        [f.tenantId, run.id],
      )
    ).rows[0].n,
    "1",
  );
});

test("intervening customer changes and equal-time provider ordering invalidate a reviewed confirmation", async () => {
  const f = fixtures[0];
  const saved = await run(f, "request.save", {
    ...proposal(f),
    details: { ...details, area: "Confirmation interval safety" },
  });
  const review = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  await publicMessage(f, review.reviewText, "staff");
  await publicMessage(f, "Use address B instead");
  const yes = await publicMessage(f, "yes");
  await assert.rejects(
    workflow(f, "confirm", {
      id: saved.id,
      version: review.version,
      messageId: yes,
    }),
    /confirmation/,
  );
  const fresh = await workflow(f, "review", {
    id: saved.id,
    version: review.version,
  });
  await publicMessage(f, fresh.reviewText, "staff");
  const currentYes = await publicMessage(f, "yes");
  const confirmed = await workflow(f, "confirm", {
    id: saved.id,
    version: fresh.version,
    messageId: currentYes,
  });
  const late = await publicMessage(f, "Actually change the date");
  await local.db.query(
    "update chat_messages set created_at=(select created_at from chat_messages where id=$1) where id=$2",
    [currentYes, late],
  );
  await assert.rejects(
    workflow(f, "approve", {
      id: saved.id,
      version: confirmed.version,
      countryCode: null,
    }),
    /confirmation/,
  );
  // A delayed capture between summary and confirmation must also invalidate approval.
  await local.db.query(
    "update chat_messages set created_at=(select created_at-interval '1 microsecond' from chat_messages where id=$1) where id=$2",
    [currentYes, late],
  );
  await assert.rejects(
    workflow(f, "approve", {
      id: saved.id,
      version: confirmed.version,
      countryCode: null,
    }),
    /confirmation/,
  );
});

test("handoff replay ignores changed provider routing observations but rejects changed user intent", async () => {
  const f = fixtures[0],
    context = ctx(f.tenantId),
    input = {
      leadId: f.leadId,
      messageId: f.messageId,
      reason: "dues",
      assigneeChatwootId: 33,
    };
  const call = async (body) =>
    (
      await local.db.query("select chat_task_command($1,'handoff',$2) result", [
        JSON.stringify(context),
        JSON.stringify(body),
      ])
    ).rows[0].result;
  const first = await call(input);
  assert.deepEqual(await call({ ...input, assigneeChatwootId: null }), first);
  await assert.rejects(call({ ...input, reason: "complaint" }), /conflict/);
});

test("lost operational approval response retains its exact command key and recovers the committed receipt", async () => {
  const f = fixtures[0],
    saved = await run(f, "request.save", {
      ...proposal(f),
      details: { ...details, area: "Lost response safety" },
    });
  const review = await workflow(f, "review", {
    id: saved.id,
    version: saved.version,
  });
  await publicMessage(f, review.reviewText, "staff");
  const yes = await publicMessage(f, "yes");
  const confirmation = await workflow(f, "confirm", {
    id: saved.id,
    version: review.version,
    messageId: yes,
  });
  const { loadServerModule } =
    await import("./chat-db-harness/server-adapter.mjs");
  let lose = true,
    calls = 0;
  const actions = loadServerModule(
    "src/features/chat/actions/server-actions.ts",
    {
      "next/cache": { revalidatePath() {} },
      "./commands": {
        runRequestWorkflow: async (body, key) => {
          calls++;
          const receipt = await workflow(
            f,
            body.action,
            body.input,
            ctx(f.tenantId, "owner", key),
          );
          if (lose) {
            lose = false;
            throw new Error("Response lost after commit");
          }
          return receipt;
        },
      },
    },
  );
  const { createConfirmedCommand } =
    await import("../src/features/leads/confirmed-command.ts");
  const guard = createConfirmedCommand(
    actions.requestWorkflowAction,
    randomUUID,
  );
  const input = {
    action: "approve",
    input: { id: saved.id, version: confirmation.version, countryCode: null },
  };
  const first = await guard.run(input);
  assert.equal(first.ok, false);
  assert.equal(first.uncertain, true);
  const changed = await guard.run({
    ...input,
    input: { ...input.input, countryCode: "IN" },
  });
  assert.equal(changed.uncertain, true);
  assert.equal(calls, 1);
  const replay = await guard.run(input);
  assert.equal(replay.ok, true);
  assert.equal(replay.status, "materialized");
  assert.equal(calls, 2);
});

async function syntheticTurn(
  f,
  scenario,
  content,
  provider = 3000,
  observedAssigneeId = null,
  nativeConversationId = 10,
) {
  const context = {
    tenantId: f.tenantId,
    actor: { type: "WEBHOOK", id: "chatwoot" },
    source: "WEBHOOK",
    correlationId: randomUUID(),
  };
  const capture = (
    await local.db.query("select chat_capture($1,'agent',$2) result", [
      JSON.stringify(context),
      JSON.stringify({
        workspaceId: f.workspaceId,
        secretHash: "a".repeat(64),
        channelId: f.channelId,
        identity: {
          displayName: "Synthetic customer",
          sourceId: "919999990000",
          phoneE164: "+919999990000",
        },
        message: {
          messageId: provider,
          accountId: 901,
          inboxId: 20,
          conversationId: nativeConversationId,
          contactId: nativeConversationId,
          status: "open",
          channelKind: "whatsapp",
          author: "customer",
          private: false,
          content,
          contentType: "text",
          attachments: [],
          staffUserId: null,
          createdAt: new Date().toISOString(),
        },
      }),
    ])
  ).rows[0].result;
  const base = {
    workspaceId: f.workspaceId,
    secretHash: "a".repeat(64),
    channelId: f.channelId,
    conversationId: capture.conversationId,
    triggerMessageId: capture.messageId,
  };
  const call = async (action, extra = {}) =>
    (
      await local.db.query("select chat_action_agent_run($1,$2,$3) result", [
        JSON.stringify(context),
        action,
        JSON.stringify({ ...base, ...extra }),
      ])
    ).rows[0].result;
  const claim = await call("claim");
  const { runAgentTurn } = await import("../src/features/chat/agent/turn.ts"),
    { createMockModel } =
      await import("../src/features/chat/agent/mock-model.ts");
  const result = await runAgentTurn(
    {
      scope: {
        tenantId: f.tenantId,
        ...Object.fromEntries(
          Object.entries(base).filter(([k]) => k !== "secretHash"),
        ),
      },
      data: claim.context,
      now: new Date().toISOString(),
    },
    createMockModel(scenario, claim.context.pack.body),
  );
  const cap = { ...base, runId: claim.runId, leaseToken: claim.leaseToken };
  await call("complete", {
    runId: claim.runId,
    leaseToken: claim.leaseToken,
    result,
    observedAssigneeId,
  });
  const pub = async (action, extra = {}) =>
    (
      await local.db.query("select chat_public_reply($1,$2,$3) result", [
        JSON.stringify(context),
        action,
        JSON.stringify({ ...cap, ...extra }),
      ])
    ).rows[0].result;
  return { context, cap, pub };
}
test("requested price image remains a draft until its text has a real public receipt; one claim and one image per conversation", async () => {
  const f = fixtures[0];
  await local.db.query(
    "with previous as(update chat_knowledge_packs set status='archived' where tenant_id=$1 and status='published' returning *) insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) select tenant_id,brand_id,version+1,'published',pack_json||$2::jsonb from previous",
    [
      f.tenantId,
      JSON.stringify({
        priceListImageUrl: "https://assets.example.invalid/approved.png",
        media: { priceListCaption: "Synthetic indicative price list." },
        review: {
          enabled: true,
          text: "Please share your experience.",
          url: "https://reviews.example.invalid/business",
          cooldownDays: 90,
        },
      }),
    ],
  );
  const packId = (
    await local.db.query(
      "select id from chat_knowledge_packs where tenant_id=$1 and status='published'",
      [f.tenantId],
    )
  ).rows[0].id;
  await local.db.query("select chat_action_configure($1,$2)", [
    JSON.stringify(ctx(f.tenantId)),
    JSON.stringify({
      channelId: f.channelId,
      version: 2,
      mode: "auto",
      canBook: true,
      packId,
      approveAuto: true,
      locationId: null,
      teamId: null,
    }),
  ]);
  let turn = await syntheticTurn(
    f,
    "price_list",
    "CH6 synthetic price_list: please show the price list",
  );
  const supplement = async (action, body, who = "owner", db = local.db) =>
    (
      await db.query("select chat_supplemental_command($1,$2,$3) result", [
        JSON.stringify(ctx(f.tenantId, who)),
        action,
        JSON.stringify(body),
      ])
    ).rows[0].result;
  assert.equal(
    (
      await supplement("prepare", {
        runId: turn.cap.runId,
        kind: "price_image",
      })
    ).status,
    "unavailable",
  );
  const row = (
    await local.db.query(
      "select id from chat_supplemental_deliveries where tenant_id=$1 and kind='price_image'",
      [f.tenantId],
    )
  ).rows[0];
  await assert.rejects(supplement("claim", { id: row.id }), /eligibility/);
  turn = await syntheticTurn(
    f,
    "price_list",
    "CH6 synthetic price_list: please show the current price list",
    3001,
  );
  await supplement("prepare", { runId: turn.cap.runId, kind: "price_image" });
  assert.equal(
    (
      await local.db.query(
        "select run_id from chat_supplemental_deliveries where id=$1",
        [row.id],
      )
    ).rows[0].run_id,
    turn.cap.runId,
  );
  assert.equal((await turn.pub("claim")).status, "claimed");
  await turn.pub("record", { providerMessageId: 5000 });
  const prepared = await supplement("prepare", {
    runId: turn.cap.runId,
    kind: "price_image",
  });
  assert.equal(prepared.id, row.id);
  assert.equal(prepared.status, "draft");
  await assert.rejects(
    supplement("claim", { id: row.id }, "viewer"),
    /access denied/,
  );
  await assert.rejects(
    local.db.query("select chat_supplemental_command($1,'claim',$2)", [
      JSON.stringify(ctx(fixtures[1].tenantId)),
      JSON.stringify({ id: row.id }),
    ]),
    /unavailable/,
  );
  const other = await local.connect();
  const claims = await Promise.all([
    supplement("claim", { id: row.id }),
    supplement("claim", { id: row.id }, "owner", other),
  ]);
  assert.equal(claims.filter((x) => x.status === "claimed").length, 1);
  await supplement("record", { id: row.id, providerMessageId: 5001 });
  assert.equal((await supplement("claim", { id: row.id })).status, "sent");
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_supplemental_deliveries where tenant_id=$1 and kind='price_image'",
        [f.tenantId],
      )
    ).rows[0].n,
    "1",
  );
  assert.equal(
    (
      await local.db.query(
        "select latency_ms>=0 ok from chat_public_outbox where run_id=$1",
        [turn.cap.runId],
      )
    ).rows[0].ok,
    true,
  );
});
test("neutral review requires opt-in and linked actual delivery; paid/completed/imported facts do not qualify, and confirmed receipt starts cooldown", async () => {
  const f = fixtures[0],
    run = (
      await local.db.query(
        "select id from chat_agent_runs where tenant_id=$1 order by created_at desc limit 1",
        [f.tenantId],
      )
    ).rows[0].id;
  const customer = (
    await local.db.query(
      "insert into customers(tenant_id,name,phone,normalized_phone_e164) values($1,'Synthetic delivery','+919999990000','+919999990000') returning id",
      [f.tenantId],
    )
  ).rows[0].id;
  const order = (
    await local.db.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,order_status,payment_status,updated_at) values($1,$2,'CH6-review','ch6-review-token','completed','paid',clock_timestamp()) returning id",
      [f.tenantId, customer],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set customer_id=$2,order_id=$3 where tenant_id=$1 and id=$4",
    [f.tenantId, customer, order, f.leadId],
  );
  const call = async (action, body) =>
    (
      await local.db.query(
        "select chat_supplemental_command($1,$2,$3) result",
        [JSON.stringify(ctx(f.tenantId)), action, JSON.stringify(body)],
      )
    ).rows[0].result;
  assert.equal(
    (await call("prepare", { runId: run, kind: "review" })).status,
    "unavailable",
  );
  await local.db.query(
    "update orders set order_status='delivered',updated_at=clock_timestamp() where id=$1",
    [order],
  );
  await local.db.query("select chat_lead_refresh($1,$2)", [
    JSON.stringify(ctx(f.tenantId)),
    JSON.stringify({ leadId: f.leadId }),
  ]);
  const won = (
    await local.db.query(
      "select stage,closed_at from leads where tenant_id=$1 and id=$2",
      [f.tenantId, f.leadId],
    )
  ).rows[0];
  assert.equal(won.stage, "won");
  assert.ok(won.closed_at);
  const prepared = await call("prepare", { runId: run, kind: "review" });
  assert.equal(prepared.status, "draft");
  const claimed = await call("claim", { id: prepared.id });
  assert.equal(
    claimed.text,
    "Please share your experience.\nhttps://reviews.example.invalid/business",
  );
  assert.equal(
    (
      await local.db.query(
        "select sent_at from chat_supplemental_deliveries where id=$1",
        [prepared.id],
      )
    ).rows[0].sent_at,
    null,
  );
  await call("record", { id: prepared.id, providerMessageId: 5002 });
  assert.ok(
    (
      await local.db.query(
        "select sent_at from chat_supplemental_deliveries where id=$1",
        [prepared.id],
      )
    ).rows[0].sent_at,
  );
  const nextOrder = (
    await local.db.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,order_status,updated_at) values($1,$2,'CH6-review-next','ch6-review-next-token','delivered',clock_timestamp()) returning id",
      [f.tenantId, customer],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set order_id=$2 where tenant_id=$1 and id=$3",
    [f.tenantId, nextOrder, f.leadId],
  );
  assert.equal(
    (await call("prepare", { runId: run, kind: "review" })).status,
    "unavailable",
  );
  const nextReview = (
    await local.db.query(
      "select id from chat_supplemental_deliveries where tenant_id=$1 and order_id=$2",
      [f.tenantId, nextOrder],
    )
  ).rows[0].id;
  await assert.rejects(call("claim", { id: nextReview }), /eligibility/);
  await local.db.query(
    "update chat_supplemental_deliveries set sent_at=now()-interval '91 days' where id=$1",
    [prepared.id],
  );
  assert.equal((await call("claim", { id: nextReview })).status, "claimed");
  await call("record", { id: nextReview, providerMessageId: 5003 });
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_supplemental_deliveries where tenant_id=$1 and kind='review'",
        [f.tenantId],
      )
    ).rows[0].n,
    "2",
  );
  // Historical source drafts never qualify, independently of their retained paid/import facts.
  const imported = (
    await local.db.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,source,financial_management,order_status) values($1,$2,'CH6-import','ch6-import-token','shopify','external_shopify','draft') returning id",
      [f.tenantId, customer],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set order_id=$2 where tenant_id=$1 and id=$3",
    [f.tenantId, imported, f.leadId],
  );
  assert.equal(
    (
      await local.db.query("select chat_supplemental_valid($1,$2) ok", [
        f.tenantId,
        prepared.id,
      ])
    ).rows[0].ok,
    false,
  );
});

test("automatic safety handoff uses mapped active assignee and atomically records a tenant-owned label intent", async () => {
  const f = fixtures[0];
  const manager = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='manager'",
      [f.tenantId],
    )
  ).rows[0].id;
  await local.db.query(
    "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,44) on conflict do nothing",
    [f.tenantId, manager],
  );
  const records = (
    await local.db.query(
      "select id,version from chat_task_records where tenant_id=$1 and lead_id=$2 and work_kind='CHAT_HANDOFF' and closed_at is null",
      [f.tenantId, f.leadId],
    )
  ).rows;
  for (const r of records)
    await local.db.query("select chat_task_command($1,'complete',$2)", [
      JSON.stringify(ctx(f.tenantId)),
      JSON.stringify(r),
    ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const turn = await syntheticTurn(
    f,
    "complaint",
    "CH6 synthetic complaint: Please help me",
    3100,
    44,
  );
  const routed = (
    await local.db.query(
      "select r.route_source,t.assigned_user_id from chat_task_records r join tasks t on t.tenant_id=r.tenant_id and t.id=r.task_id where r.tenant_id=$1 and r.lead_id in (select id from leads where tenant_id=$1 and conversation_id=$2 and closed_at is null) and r.closed_at is null and r.work_kind='CHAT_HANDOFF'",
      [f.tenantId, turn.cap.conversationId],
    )
  ).rows[0];
  assert.equal(routed.route_source, "chatwoot");
  assert.equal(routed.assigned_user_id, manager);
  const context = turn.context,
    base = { ...turn.cap };
  delete base.runId;
  delete base.leaseToken;
  const label = async (action, ctxValue = context) =>
    (
      await local.db.query("select chat_handoff_label($1,$2,$3) result", [
        JSON.stringify(ctxValue),
        action,
        JSON.stringify(base),
      ])
    ).rows[0].result;
  await assert.rejects(
    label("claim", { ...context, tenantId: fixtures[1].tenantId }),
    /unavailable/,
  );
  const claim = await label("claim");
  assert.equal(claim.label, "osplus-handoff");
  assert.equal(claim.accountId, 901);
  assert.equal((await label("claim")).status, "sending");
  await label("record");
  assert.equal((await label("claim")).status, "sent");
});

test("a staff handoff drains its label intent immediately without an agent or another customer message", async () => {
  const f = fixtures[1],
    { loadServerModule } = await import("./chat-db-harness/server-adapter.mjs"),
    { z } = await import("zod");
  const schemas = await import("../src/features/chat/actions/schemas.ts"),
    view = await import("../src/features/chat/actions/view-schemas.ts");
  const previous = { ...process.env };
  let posts = 0,
    configBroken = false;
  const db = {
    rpc: async (name, args) => {
      try {
        const result = (
          await local.db.query("select " + name + "($1,$2,$3) result", [
            JSON.stringify(args.p_context),
            args.p_action,
            JSON.stringify(args.p_input),
          ])
        ).rows[0].result;
        return { data: result, error: null };
      } catch {
        return { data: null, error: { message: "Unavailable" } };
      }
    },
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { chatwoot_account_id: 902 }, error: null }),
    }),
  };
  const worker = loadServerModule("src/features/chat/actions/label-worker.ts", {
    zod: { z },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
    "../connection": {
      chatwootOrigin: () => {
        if (configBroken) throw new Error("Missing provider configuration");
        return "https://localhost:4444";
      },
      accountClient: () => ({
        mergeConversationLabel: async () => {
          posts++;
        },
      }),
    },
  });
  const commands = loadServerModule("src/features/chat/actions/commands.ts", {
    zod: { z },
    "@/core/command-context/server": {
      createUserCommandContext: (c, o = {}) => ({ ...ctx(c.tenant.id), ...o }),
    },
    "../module": {
      requireChatPermission: async () => ({
        context: { tenant: { id: f.tenantId } },
        db,
      }),
    },
    "../schemas": { commandKeySchema: z.string().uuid() },
    "./schemas": schemas,
    "./view-schemas": view,
    "../knowledge-pack": {},
    "../connection": {},
    "./label-worker": worker,
    "../notifications/trigger": { scheduleNotificationCheck: async () => {} },
  });
  try {
    Object.assign(process.env, {
      CHAT_ACTIONS_ENABLED: "true",
      CHAT_DRY_RUN: "false",
      CHAT_AGENT_MODEL_MODE: "mock",
    });
    await local.db.query(
      "update chat_channels set agent_mode='off' where tenant_id=$1",
      [f.tenantId],
    );
    const count = (
      await local.db.query(
        "select count(*) n from chat_messages where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n;
    const request = {
        action: "handoff",
        input: { leadId: f.leadId, messageId: f.messageId, reason: "dues" },
      },
      key = randomUUID();
    const receipt = await commands.runChatTask(request, key);
    assert.ok(receipt.taskId);
    assert.equal(posts, 1);
    configBroken = true;
    assert.deepEqual(await commands.runChatTask(request, key), receipt);
    assert.equal(
      (
        await local.db.query(
          "select state from chat_handoff_labels where tenant_id=$1 and conversation_id=$2",
          [f.tenantId, f.conversationId],
        )
      ).rows[0].state,
      "sent",
    );
    assert.equal(
      (
        await local.db.query(
          "select count(*) n from chat_messages where tenant_id=$1",
          [f.tenantId],
        )
      ).rows[0].n,
      count,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test("a reused conversation resolves its current open lead and rebases only untouched price drafts without inheriting an old order", async () => {
  const f = fixtures[0],
    first = await syntheticTurn(
      f,
      "price_list",
      "CH6 synthetic price_list: first inquiry",
      3300,
      null,
      3300,
    );
  const old = (
    await local.db.query(
      "select id,ref_code from leads where tenant_id=$1 and conversation_id=$2 and closed_at is null",
      [f.tenantId, first.cap.conversationId],
    )
  ).rows[0];
  const prepare = async (turn, kind) =>
    (
      await local.db.query(
        "select chat_supplemental_command($1,'prepare',$2) result",
        [
          JSON.stringify(ctx(f.tenantId)),
          JSON.stringify({ runId: turn.cap.runId, kind }),
        ],
      )
    ).rows[0].result;
  await prepare(first, "price_image");
  const draft = (
    await local.db.query(
      "select id from chat_supplemental_deliveries where tenant_id=$1 and lead_id=$2 and kind='price_image'",
      [f.tenantId, old.id],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set stage='lost',closed_at=now(),lost_reason='synthetic closure',order_id=$2 where tenant_id=$1 and id=$3",
    [
      f.tenantId,
      (
        await local.db.query(
          "select id from orders where tenant_id=$1 and order_number='CH6-review'",
          [f.tenantId],
        )
      ).rows[0].id,
      old.id,
    ],
  );
  await new Promise((resolve) => setTimeout(resolve, 20)); // Provider millisecond clock must follow the database closure instant.
  const current = await syntheticTurn(
    f,
    "price_list",
    "CH6 synthetic price_list: new inquiry",
    3301,
    null,
    3300,
  );
  const lead = (
    await local.db.query(
      "select id,ref_code,order_id from leads where tenant_id=$1 and conversation_id=$2 and closed_at is null",
      [f.tenantId, current.cap.conversationId],
    )
  ).rows[0];
  assert.notEqual(lead.id, old.id);
  assert.equal(lead.order_id, null);
  const context = (
    await local.db.query("select chat_action_context($1,$2) result", [
      f.tenantId,
      current.cap.conversationId,
    ])
  ).rows[0].result;
  assert.equal(context.leadRef, lead.ref_code);
  assert.equal(context.request, null);
  await prepare(current, "price_image");
  const rebound = (
    await local.db.query(
      "select lead_id,run_id from chat_supplemental_deliveries where id=$1",
      [draft],
    )
  ).rows[0];
  assert.equal(rebound.lead_id, lead.id);
  assert.equal(rebound.run_id, current.cap.runId);
  assert.equal((await prepare(current, "review")).status, "unavailable");
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from chat_supplemental_deliveries where tenant_id=$1 and lead_id=$2 and kind='review'",
        [f.tenantId, lead.id],
      )
    ).rows[0].n,
    "0",
  );
});
