import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local, channel, workspace;
const tenant = "50000000-0000-4000-8000-000000000001",
  hash = "a".repeat(64);
const context = {
  tenantId: tenant,
  actor: { type: "WEBHOOK", id: "chatwoot" },
  source: "WEBHOOK",
  correlationId: "lead-test",
};
const message = {
  messageId: 1,
  accountId: 10,
  inboxId: 20,
  conversationId: 30,
  contactId: 40,
  status: "open",
  channelKind: "website",
  author: "customer",
  private: false,
  content: "Synthetic enquiry",
  contentType: "text",
  createdAt: "2026-10-01T00:00:00Z",
  staffUserId: null,
  attachments: [],
};
before(
  async () => {
    local = await startChatDatabase();
    const d = local.db;
    await d.query(
      "insert into tenants(id,name,slug,store_name) values($1,'Lead fixture','lead-fixture','Lead fixture')",
      [tenant],
    );
    await d.query(
      "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
      [tenant],
    );
    await d.query("insert into chat_settings(tenant_id) values($1)", [tenant]);
    workspace = (
      await d.query(
        "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',10,$2,$3,'gcm1.v1.fixture','active') returning id",
        [tenant, "w".repeat(32), hash],
      )
    ).rows[0].id;
    const brand = (
      await d.query(
        "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Example','example','Example assistant') returning id",
        [tenant],
      )
    ).rows[0].id;
    channel = (
      await d.query(
        "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,20,'website','Example') returning id",
        [tenant, workspace, brand],
      )
    ).rows[0].id;
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
const capture = (
  d,
  event = message,
  kind = "events",
  identity = { displayName: "Example Visitor", sourceId: "visitor-a" },
) =>
  d
    .query("select chat_capture($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      kind,
      JSON.stringify({
        workspaceId: workspace,
        secretHash: hash,
        channelId: channel,
        message: event,
        identity,
      }),
    ])
    .then((r) => r.rows[0].result);
test("an enquiry atomically creates one contact and open lead; independent callback retries preserve both", async () => {
  await capture(local.db, message, "agent");
  const second = await local.connect();
  await Promise.all([capture(local.db), capture(second, message, "agent")]);
  const r = (
    await local.db.query(
      "select c.display_name,l.stage,l.ref_code,l.first_customer_at from chat_contacts c join leads l on l.tenant_id=c.tenant_id and l.contact_id=c.id where c.tenant_id=$1",
      [tenant],
    )
  ).rows;
  assert.equal(r.length, 1);
  assert.equal(r[0].display_name, "Example Visitor");
  assert.equal(r[0].stage, "new");
  assert.match(r[0].ref_code, /^[2-9A-HJKMNP-Z]{5}$/);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_contact_identities where tenant_id=$1",
        [tenant],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from lead_events where tenant_id=$1 and kind='created'",
        [tenant],
      )
    ).rows[0].n,
    1,
  );
});

test("trusted WhatsApp phone resolves across provider contacts, but conflicting existing contacts are never automatically merged", async () => {
  const d = local.db;
  await d.query(
    "update chat_channels set kind='whatsapp' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
  const event = {
    ...message,
    channelKind: "whatsapp",
    messageId: 20,
    conversationId: 50,
    contactId: 60,
  };
  const identity = {
    displayName: "Phone fixture",
    sourceId: "919876543210",
    phoneE164: "+919876543210",
  };
  await capture(d, event, "events", identity);
  await capture(
    d,
    { ...event, messageId: 21, conversationId: 51, contactId: 61 },
    "events",
    identity,
  );
  const rows = (
    await d.query(
      "select contact_id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id in (50,51)",
      [tenant],
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].contact_id, rows[1].contact_id);
  // Existing website contact now claims the phone. Keep both records; record a review candidate.
  await capture(
    d,
    { ...event, messageId: 22, conversationId: 30, contactId: 40 },
    "events",
    identity,
  );
  const contacts = (
    await d.query(
      "select count(distinct contact_id)::int n from chat_conversations where tenant_id=$1",
      [tenant],
    )
  ).rows[0].n;
  assert.equal(contacts, 2);
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from chat_identity_conflicts where tenant_id=$1",
        [tenant],
      )
    ).rows[0].n,
    1,
  );
  await d.query(
    "update chat_channels set kind='website' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
});

test("lead reply clocks ignore private/system traffic, accept delayed public evidence, and assign only a mapped active staff owner", async () => {
  const d = local.db;
  const staffId = (
    await d.query(
      "insert into tenant_users(tenant_id,clerk_user_id,email,role,status) values($1,'lead-staff','staff@example.invalid','manager','active') returning id",
      [tenant],
    )
  ).rows[0].id;
  await d.query(
    "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,99)",
    [tenant, staffId],
  );
  const event = {
    ...message,
    messageId: 31,
    author: "staff",
    staffUserId: 99,
    createdAt: "2026-10-01T02:00:00Z",
  };
  await capture(d, { ...event, private: true });
  await capture(d, {
    ...event,
    messageId: 32,
    author: "system",
    staffUserId: null,
  });
  const get = () =>
    d
      .query(
        "select * from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=30) and closed_at is null",
        [tenant],
      )
      .then((r) => r.rows[0]);
  assert.equal((await get()).first_human_response_at, null);
  await capture(d, { ...event, messageId: 33 });
  await capture(d, {
    ...event,
    messageId: 34,
    createdAt: "2026-10-01T01:00:00Z",
  });
  const lead = await get();
  assert.equal(
    lead.first_response_at.toISOString(),
    "2026-10-01T01:00:00.000Z",
  );
  assert.equal(
    lead.first_human_response_at.toISOString(),
    "2026-10-01T01:00:00.000Z",
  );
  assert.equal(lead.last_reply_at.toISOString(), "2026-10-01T02:00:00.000Z");
  assert.equal(lead.owner_tenant_user_id, staffId);
  assert.equal(lead.stage, "engaged");
});

const userContext = {
  tenantId: tenant,
  actor: { type: "USER", id: "lead-staff" },
  source: "OS_PLUS_UI",
  correlationId: "lead-command",
};
const command = (action, input, key = action) =>
  local.db
    .query("select chat_lead_command($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify({ ...userContext, idempotencyKey: key }),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("conversion atomically reuses a canonical customer on exact phone and retries return one audited receipt", async () => {
  const lead = (
    await local.db.query(
      "select * from leads where tenant_id=$1 order by first_customer_at,id limit 1",
      [tenant],
    )
  ).rows[0];
  const input = {
    contactId: lead.contact_id,
    name: "Synthetic Customer",
    phoneE164: "+919999999999",
    phone: "+91 9999999999",
  };
  const result = await command("contact.convert", input, "convert-a");
  assert.ok(result.customerId);
  assert.deepEqual(
    await command("contact.convert", input, "convert-a"),
    result,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from customers where tenant_id=$1 and normalized_phone_e164=$2",
        [tenant, input.phoneE164],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    command("contact.convert", { ...input, name: "Changed" }, "convert-a"),
  );
  const second = (
    await local.db.query(
      "select id from chat_contacts where tenant_id=$1 and id<>$2 limit 1",
      [tenant, lead.contact_id],
    )
  ).rows[0];
  const reused = await command(
    "contact.convert",
    { ...input, contactId: second.id },
    "convert-b",
  );
  assert.equal(reused.customerId, result.customerId);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from lead_events where tenant_id=$1 and kind='converted'",
        [tenant],
      )
    ).rows[0].n,
    3,
  );
});

test("manager edits require current version and active same-tenant owner, while viewer and disabled modules are denied", async () => {
  const d = local.db;
  const lead = (
    await d.query(
      "select * from leads where tenant_id=$1 order by id limit 1",
      [tenant],
    )
  ).rows[0];
  const changed = await command(
    "lead.edit",
    {
      leadId: lead.id,
      version: lead.version,
      stage: "lost",
      lostReason: "Owner marked irrelevant",
      notes: "Synthetic note",
    },
    "edit-a",
  );
  assert.equal(changed.id, lead.id);
  const row = (
    await d.query("select * from leads where tenant_id=$1 and id=$2", [
      tenant,
      lead.id,
    ])
  ).rows[0];
  assert.equal(row.stage, "lost");
  assert.ok(row.closed_at);
  assert.equal(row.notes, "Synthetic note");
  await assert.rejects(
    command(
      "lead.edit",
      { leadId: lead.id, version: lead.version, stage: "new" },
      "stale",
    ),
  );
  await d.query(
    "update tenant_users set role='viewer' where tenant_id=$1 and clerk_user_id='lead-staff'",
    [tenant],
  );
  await assert.rejects(
    command(
      "lead.edit",
      { leadId: lead.id, version: row.version, stage: "new" },
      "viewer",
    ),
  );
  await d.query(
    "update tenant_users set role='manager' where tenant_id=$1 and clerk_user_id='lead-staff'",
    [tenant],
  );
  await d.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [tenant],
  );
  await assert.rejects(
    command(
      "contact.convert",
      { contactId: lead.contact_id, name: "Example" },
      "disabled",
    ),
  );
  await d.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [tenant],
  );
});

test("manual merge preserves identities/history and audited split reverses it; changed post-merge state blocks unsafe undo", async () => {
  const d = local.db;
  const people = (
    await d.query(
      "select * from chat_contacts where tenant_id=$1 and merged_into is null order by id",
      [tenant],
    )
  ).rows;
  const input = {
    fromId: people[0].id,
    toId: people[1].id,
    fromVersion: people[0].version,
    toVersion: people[1].version,
  };
  const merged = await command("contact.merge", input, "merge-a");
  assert.ok(merged.mergeId);
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from chat_contact_identities where tenant_id=$1 and contact_id=$2",
        [tenant, input.fromId],
      )
    ).rows[0].n,
    0,
  );
  await command("contact.split", { mergeId: merged.mergeId }, "split-a");
  assert.ok(
    (
      await d.query(
        "select count(*)::int n from chat_contact_identities where tenant_id=$1 and contact_id=$2",
        [tenant, input.fromId],
      )
    ).rows[0].n > 0,
  );
  const current = (
    await d.query(
      "select * from chat_contacts where tenant_id=$1 order by id",
      [tenant],
    )
  ).rows;
  const again = await command(
    "contact.merge",
    {
      ...input,
      fromVersion: current[0].version,
      toVersion: current[1].version,
    },
    "merge-b",
  );
  const l = (
    await d.query(
      "select * from leads where tenant_id=$1 and contact_id=$2 limit 1",
      [tenant, input.toId],
    )
  ).rows[0];
  await command(
    "lead.edit",
    { leadId: l.id, version: l.version, notes: "Edited after merge" },
    "post-merge",
  );
  await assert.rejects(
    command("contact.split", { mergeId: again.mergeId }, "unsafe-split"),
  );
});

const refresh = (input = {}) =>
  local.db
    .query("select chat_lead_refresh($1::jsonb,$2::jsonb) result", [
      JSON.stringify(userContext),
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("refresh reads only the explicitly linked actual order: production completion is in progress, actual delivery wins, and old unrelated paid orders do not", async () => {
  const d = local.db;
  const l = (
    await d.query(
      "select * from leads where tenant_id=$1 and closed_at is null limit 1",
      [tenant],
    )
  ).rows[0];
  await d.query(
    "update leads set last_customer_at=now() where tenant_id=$1 and id=$2",
    [tenant, l.id],
  );
  const order = (
    await d.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,order_status,total_amount) values($1,$2,'LEAD-QA','synthetic-order-tracking','completed',100) returning id",
      [tenant, l.customer_id],
    )
  ).rows[0].id;
  await refresh({ leadId: l.id });
  assert.notEqual(
    (
      await d.query("select stage from leads where tenant_id=$1 and id=$2", [
        tenant,
        l.id,
      ])
    ).rows[0].stage,
    "won",
  );
  const current = (
    await d.query("select version from leads where tenant_id=$1 and id=$2", [
      tenant,
      l.id,
    ])
  ).rows[0];
  await command(
    "lead.record",
    { leadId: l.id, version: current.version, orderId: order },
    "link-order",
  );
  await refresh({ leadId: l.id });
  assert.equal(
    (
      await d.query("select stage from leads where tenant_id=$1 and id=$2", [
        tenant,
        l.id,
      ])
    ).rows[0].stage,
    "in_progress",
  );
  await d.query(
    "update orders set order_status='delivered' where tenant_id=$1 and id=$2",
    [tenant, order],
  );
  await refresh({ leadId: l.id });
  await refresh({ leadId: l.id });
  assert.equal(
    (
      await d.query("select stage from leads where tenant_id=$1 and id=$2", [
        tenant,
        l.id,
      ])
    ).rows[0].stage,
    "won",
  );
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from lead_events where tenant_id=$1 and lead_id=$2 and kind='stage' and meta_json->>'to'='won'",
        [tenant, l.id],
      )
    ).rows[0].n,
    1,
  );
});

test("WhatsApp reference codes create a cross-channel review candidate, never silently move an existing identity", async () => {
  const d = local.db;
  await d.query(
    "update chat_channels set kind='instagram' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
  await capture(
    d,
    {
      ...message,
      messageId: 100,
      conversationId: 100,
      contactId: 100,
      channelKind: "instagram",
    },
    "events",
    { sourceId: "synthetic-instagram" },
  );
  const target = (
    await d.query(
      "select * from leads where tenant_id=$1 and channel_kind='instagram'",
      [tenant],
    )
  ).rows[0];
  await d.query(
    "update chat_channels set kind='whatsapp' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
  await capture(
    d,
    {
      ...message,
      messageId: 101,
      conversationId: 101,
      contactId: 101,
      channelKind: "whatsapp",
      content: "REF:" + target.ref_code,
    },
    "events",
    { sourceId: "919111111111", phoneE164: "+919111111111" },
  );
  const actual = (
    await d.query(
      "select contact_id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=101",
      [tenant],
    )
  ).rows[0];
  assert.notEqual(actual.contact_id, target.contact_id);
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from chat_identity_conflicts where tenant_id=$1 and kind='lead_ref' and candidate_contact_id=$2",
        [tenant, target.contact_id],
      )
    ).rows[0].n,
    1,
  );
  await d.query(
    "update chat_channels set kind='website' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
});

test("two tenants with the same exact phone create separate contacts/leads and reject cross-tenant FK/command access; browser roles cannot read or mutate CRM", async () => {
  const d = local.db,
    other = "50000000-0000-4000-8000-000000000002";
  await d.query(
    "insert into tenants(id,name,slug,store_name) values($1,'Other synthetic','lead-other','Other')",
    [other],
  );
  await d.query(
    "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
    [other],
  );
  await d.query("insert into chat_settings(tenant_id) values($1)", [other]);
  const w = (
    await d.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://other.example.invalid',10,$2,$3,'gcm1.v1.fixture','active') returning id",
      [other, "z".repeat(32), hash],
    )
  ).rows[0].id;
  const b = (
    await d.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Other','other','Other') returning id",
      [other],
    )
  ).rows[0].id;
  const c = (
    await d.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,20,'whatsapp','Other') returning id",
      [other, w, b],
    )
  ).rows[0].id;
  await d.query(
    "update chat_channels set kind='whatsapp' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
  const event = {
    ...message,
    messageId: 201,
    conversationId: 201,
    contactId: 201,
    channelKind: "whatsapp",
  };
  const identity = { sourceId: "919222222222", phoneE164: "+919222222222" };
  const db2 = await local.connect();
  await Promise.all([
    capture(d, event, "events", identity),
    db2.query("select chat_capture($1::jsonb,'events',$2::jsonb)", [
      JSON.stringify({ ...context, tenantId: other }),
      JSON.stringify({
        workspaceId: w,
        channelId: c,
        secretHash: hash,
        message: event,
        identity,
      }),
    ]),
  ]);
  const people = (
    await d.query(
      "select tenant_id,contact_id from chat_contact_identities where kind='phone' and value='+919222222222' order by tenant_id",
    )
  ).rows;
  assert.equal(people.length, 2);
  assert.notEqual(people[0].contact_id, people[1].contact_id);
  await assert.rejects(
    d.query("update leads set contact_id=$1 where tenant_id=$2", [
      people[0].contact_id,
      other,
    ]),
    { code: "23503" },
  );
  await assert.rejects(
    command(
      "contact.convert",
      { contactId: people[1].contact_id, name: "Foreign" },
      "foreign-contact",
    ),
  );
  for (const role of ["anon", "authenticated"]) {
    await d.query("set role " + role);
    try {
      for (const table of [
        "chat_contacts",
        "chat_contact_identities",
        "leads",
        "lead_events",
        "chat_identity_conflicts",
        "chat_contact_merges",
      ])
        await assert.rejects(d.query("select * from " + table), {
          code: "42501",
        });
      await assert.rejects(
        d.query(
          "select chat_lead_command($1::jsonb,'contact.convert',$2::jsonb)",
          [
            JSON.stringify(userContext),
            JSON.stringify({ contactId: people[0].contact_id, name: "Denied" }),
          ],
        ),
        { code: "42501" },
      );
    } finally {
      await d.query("reset role");
    }
  }
  await d.query("set role service_role");
  try {
    await assert.rejects(d.query("update leads set notes='bare write'"), {
      code: "42501",
    });
    await assert.rejects(
      d.query("select chat_capture_memory($1::jsonb,'events','{}')", [
        JSON.stringify(context),
      ]),
      { code: "42501" },
    );
  } finally {
    await d.query("reset role");
  }
  await d.query(
    "update chat_channels set kind='website' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
});
test("customer conversion rolls back customer, link and retry receipt when its audit cannot be written", async () => {
  const d = local.db;
  const person = (
    await d.query(
      "select id from chat_contacts where tenant_id=$1 and customer_id is null and merged_into is null limit 1",
      [tenant],
    )
  ).rows[0];
  await d.query(
    "create function chat_test_reject_conversion() returns trigger language plpgsql as $$ begin if new.event_type='chat.contact.converted' then raise exception 'Synthetic audit failure'; end if; return new; end $$",
  );
  await d.query(
    "create trigger chat_test_reject_conversion before insert on domain_events for each row execute function chat_test_reject_conversion()",
  );
  try {
    await assert.rejects(
      command(
        "contact.convert",
        {
          contactId: person.id,
          name: "Rollback customer",
          phoneE164: "+919333333333",
          phone: "+919333333333",
        },
        "rollback",
      ),
    );
  } finally {
    await d.query("drop trigger chat_test_reject_conversion on domain_events");
    await d.query("drop function chat_test_reject_conversion()");
  }
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from customers where tenant_id=$1 and normalized_phone_e164='+919333333333'",
        [tenant],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await d.query(
        "select customer_id from chat_contacts where tenant_id=$1 and id=$2",
        [tenant, person.id],
      )
    ).rows[0].customer_id,
    null,
  );
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from command_idempotency where tenant_id=$1 and command_type='CHAT_LEAD' and idempotency_key='rollback'",
        [tenant],
      )
    ).rows[0].n,
    0,
  );
});

test("verified exact WhatsApp phone links an active existing customer without creating or rewriting customer records", async () => {
  const d = local.db;
  const customer = (
    await d.query(
      "insert into customers(tenant_id,name,phone,normalized_phone_e164) values($1,'Existing untouched','+919444444444','+919444444444') returning id",
      [tenant],
    )
  ).rows[0].id;
  await d.query(
    "update chat_channels set kind='whatsapp' where tenant_id=$1 and id=$2",
    [tenant, channel],
  );
  await capture(
    d,
    {
      ...message,
      messageId: 301,
      conversationId: 301,
      contactId: 301,
      channelKind: "whatsapp",
    },
    "events",
    {
      displayName: "Different profile name",
      sourceId: "919444444444",
      phoneE164: "+919444444444",
    },
  );
  const row = (
    await d.query(
      "select customer_id from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=301)",
      [tenant],
    )
  ).rows[0];
  assert.equal(row.customer_id, customer);
  assert.equal(
    (
      await d.query("select name from customers where tenant_id=$1 and id=$2", [
        tenant,
        customer,
      ])
    ).rows[0].name,
    "Existing untouched",
  );
});

test("captured repeat-customer inquiries estimate median actual order value without using history for stage advancement", async () => {
  const d = local.db;
  const customer = (
    await d.query(
      "select id from customers where tenant_id=$1 and normalized_phone_e164='+919444444444'",
      [tenant],
    )
  ).rows[0].id;
  await d.query(
    "insert into orders(tenant_id,customer_id,order_number,tracking_token,total_amount) values($1,$2,'MEDIAN-1','median-token-1',50),($1,$2,'MEDIAN-2','median-token-2',150)",
    [tenant, customer],
  );
  await capture(
    d,
    {
      ...message,
      messageId: 302,
      conversationId: 302,
      contactId: 302,
      channelKind: "whatsapp",
    },
    "events",
    { sourceId: "919444444444", phoneE164: "+919444444444" },
  );
  const row = (
    await d.query(
      "select stage,est_value from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=302)",
      [tenant],
    )
  ).rows[0];
  assert.equal(row.stage, "new");
  assert.equal(Number(row.est_value), 100);
});

test("real HTTP stage maintenance reaches PostgreSQL, closes only eligible silence and paged repeat is idempotent", async () => {
  const { handleLeadRefresh } =
    await import("../src/features/leads/refresh-handler.ts");
  const { createServer } = await import("node:http");
  const d = local.db,
    secret = "synthetic-stage-secret-" + "z".repeat(40),
    env = {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_LEAD_REFRESH_ENABLED: "true",
      CHAT_LEAD_REFRESH_SECRET: secret,
    };
  await d.query(
    "update leads set kind='service' where tenant_id=$1 and channel_kind='instagram'",
    [tenant],
  );
  const deps = {
    refresh: async (ctx, input) =>
      (
        await d.query("select chat_lead_refresh($1::jsonb,$2::jsonb) result", [
          JSON.stringify(ctx),
          JSON.stringify(input),
        ])
      ).rows[0].result,
  };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await handleLeadRefresh(
      new Request("http://127.0.0.1/stages", {
        method: req.method,
        headers: req.headers,
        body: Buffer.concat(chunks),
      }),
      deps,
      env,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const request = () =>
      fetch("http://127.0.0.1:" + server.address().port, {
        method: "POST",
        headers: { authorization: "Bearer " + secret },
        body: JSON.stringify({ tenantId: tenant }),
      });
    const first = await request();
    assert.equal(first.status, 200);
    assert.ok((await first.json()).updated > 0);
    const second = await request();
    assert.equal(second.status, 200);
    assert.equal((await second.json()).updated, 0);
    const service = (
      await d.query(
        "select stage from leads where tenant_id=$1 and kind='service'",
        [tenant],
      )
    ).rows[0];
    assert.equal(service.stage, "new");
    assert.equal(
      (
        await d.query(
          "select count(*)::int n from leads where tenant_id=$1 and stage='lost' and lost_reason='customer_silence'",
          [tenant],
        )
      ).rows[0].n > 0,
      true,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("actual server command authorizes the tenant/module/role and writes through the transactional RPC", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const d = local.db,
    base = postgresAdapter(d);
  const adapter = {
    ...base,
    rpc: async (name, args) => {
      try {
        return {
          data: (
            await d.query(
              "select chat_lead_command($1::jsonb,$2,$3::jsonb) result",
              [
                JSON.stringify(args.p_context),
                args.p_action,
                JSON.stringify(args.p_input),
              ],
            )
          ).rows[0].result,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
  const membership = (
    await d.query(
      "select * from tenant_users where tenant_id=$1 and clerk_user_id='lead-staff'",
      [tenant],
    )
  ).rows[0];
  const context = { tenant: { id: tenant, status: "active" }, membership };
  const policy = await import("../src/features/chat/permissions.ts");
  const guardModule = loadServerModule("src/features/chat/module.ts", {
    "@/lib/tenant/context": { requireTenantContext: async () => context },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => adapter },
    "./permissions": policy,
  });
  const ctx = loadServerModule("src/core/command-context/server.ts", {});
  const commandModule = loadServerModule("src/features/leads/commands.ts", {
    zod: await import("zod"),
    "@/core/command-context/server": ctx,
    "../chat/module": guardModule,
    "../chat/schemas": await import("../src/features/chat/schemas.ts"),
    "./schemas": await import("../src/features/leads/schemas.ts"),
  });
  const previous = process.env.CHAT_FOUNDATION_ENABLED;
  process.env.CHAT_FOUNDATION_ENABLED = "true";
  try {
    const lead = (
      await d.query("select * from leads where tenant_id=$1 limit 1", [tenant])
    ).rows[0];
    const saved = await commandModule.runLeadCommand(
      {
        action: "lead.edit",
        input: {
          leadId: lead.id,
          version: lead.version,
          notes: "Actual server command",
        },
      },
      "70000000-0000-4000-8000-000000000001",
    );
    assert.equal(saved.id, lead.id);
    context.membership = { ...membership, role: "viewer" };
    await assert.rejects(
      commandModule.runLeadCommand(
        {
          action: "lead.edit",
          input: { leadId: lead.id, version: saved.version, notes: "Denied" },
        },
        "70000000-0000-4000-8000-000000000002",
      ),
    );
  } finally {
    if (previous === undefined) delete process.env.CHAT_FOUNDATION_ENABLED;
    else process.env.CHAT_FOUNDATION_ENABLED = previous;
  }
});

test("legacy captured inquiries backfill once from retained transport facts without inventing phone possession", async () => {
  const d = local.db,
    event = {
      ...message,
      messageId: 901,
      conversationId: 901,
      contactId: 901,
      channelKind: "whatsapp",
    };
  await d.query("select chat_capture_memory($1::jsonb,'events',$2::jsonb)", [
    JSON.stringify(context),
    JSON.stringify({
      workspaceId: workspace,
      channelId: channel,
      secretHash: hash,
      message: event,
    }),
  ]);
  const run = () =>
    d.query("select chat_lead_backfill($1::jsonb) result", [
      JSON.stringify(userContext),
    ]);
  await run();
  const counts = await d.query(
    "select (select count(*) from chat_contacts where tenant_id=$1)::int contacts,(select count(*) from leads where tenant_id=$1)::int leads,(select count(*) from lead_events where tenant_id=$1)::int events",
    [tenant],
  );
  await run();
  assert.deepEqual(
    (
      await d.query(
        "select (select count(*) from chat_contacts where tenant_id=$1)::int contacts,(select count(*) from leads where tenant_id=$1)::int leads,(select count(*) from lead_events where tenant_id=$1)::int events",
        [tenant],
      )
    ).rows,
    counts.rows,
  );
  const identities = (
    await d.query(
      "select i.kind from chat_contact_identities i join chat_conversations c on c.tenant_id=i.tenant_id and c.contact_id=i.contact_id where c.tenant_id=$1 and c.chatwoot_conversation_id=901",
      [tenant],
    )
  ).rows;
  assert.deepEqual(
    identities.map((i) => i.kind),
    ["chatwoot_contact"],
  );
});
test("reference collision retries are bounded and exhausted allocation rolls back message/contact/audit together", async () => {
  const d = local.db;
  await d.query("begin");
  try {
    // Disposable PostgreSQL only; rollback restores pgcrypto's original function.
    await d.query(
      "create or replace function public.gen_random_bytes(integer) returns bytea language sql as $$ select decode(repeat('00',$1),'hex') $$",
    );
    const input = (event) => [
      JSON.stringify(context),
      JSON.stringify({
        workspaceId: workspace,
        channelId: channel,
        secretHash: hash,
        message: { ...message, channelKind: "whatsapp", ...event },
      }),
    ];
    await d.query(
      "select chat_capture($1::jsonb,'events',$2::jsonb)",
      input({ messageId: 950, conversationId: 950, contactId: 950 }),
    );
    await d.query("savepoint collision");
    await assert.rejects(
      d.query(
        "select chat_capture($1::jsonb,'events',$2::jsonb)",
        input({ messageId: 951, conversationId: 951, contactId: 951 }),
      ),
      /Lead reference unavailable/,
    );
    await d.query("rollback to savepoint collision");
    assert.equal(
      (
        await d.query(
          "select count(*)::int n from chat_messages where tenant_id=$1 and chatwoot_message_id=951",
          [tenant],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await d.query("rollback");
  }
});

test("a mapped staff member downgraded to viewer or finance cannot be assigned a lead automatically", async () => {
  const d = local.db;
  for (const [index, role] of ["viewer", "finance"].entries()) {
    await d.query(
      "update tenant_users set role=$2 where tenant_id=$1 and clerk_user_id='lead-staff'",
      [tenant, role],
    );
    const event = {
      ...message,
      messageId: 1100 + index * 2,
      conversationId: 1100 + index,
      contactId: 1100 + index,
      channelKind: "whatsapp",
    };
    await capture(d, event, "events", {});
    await capture(
      d,
      {
        ...event,
        messageId: event.messageId + 1,
        author: "staff",
        staffUserId: 99,
        createdAt: "2026-10-01T01:00:00Z",
      },
      "events",
      {},
    );
    const lead = (
      await d.query(
        "select owner_tenant_user_id from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=$2)",
        [tenant, event.conversationId],
      )
    ).rows[0];
    assert.equal(lead.owner_tenant_user_id, null);
  }
  await d.query(
    "update tenant_users set role='manager' where tenant_id=$1 and clerk_user_id='lead-staff'",
    [tenant],
  );
});

test("late earlier staff evidence corrects an automatic owner while manual ownership stays fixed", async () => {
  const d = local.db;
  const manager = (
    await d.query(
      "insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'second-manager','manager','active') returning id",
      [tenant],
    )
  ).rows[0].id;
  await d.query(
    "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,100)",
    [tenant, manager],
  );
  const event = {
    ...message,
    messageId: 1200,
    conversationId: 1200,
    contactId: 1200,
    channelKind: "whatsapp",
  };
  await capture(d, event, "events", {});
  await capture(
    d,
    {
      ...event,
      messageId: 1201,
      author: "staff",
      staffUserId: 100,
      createdAt: "2026-10-01T02:00:00Z",
    },
    "events",
    {},
  );
  await capture(
    d,
    {
      ...event,
      messageId: 1202,
      author: "staff",
      staffUserId: 99,
      createdAt: "2026-10-01T01:00:00Z",
    },
    "events",
    {},
  );
  const get = () =>
    d
      .query(
        "select * from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=1200)",
        [tenant],
      )
      .then((r) => r.rows[0]);
  const earlier = (
    await d.query(
      "select id from tenant_users where tenant_id=$1 and clerk_user_id='lead-staff'",
      [tenant],
    )
  ).rows[0].id;
  const automatic = await get();
  assert.equal(automatic.owner_tenant_user_id, earlier);
  await command(
    "lead.edit",
    { leadId: automatic.id, version: automatic.version, ownerId: manager },
    "manual-owner",
  );
  await capture(
    d,
    {
      ...event,
      messageId: 1203,
      author: "staff",
      staffUserId: 99,
      createdAt: "2026-10-01T00:30:00Z",
    },
    "events",
    {},
  );
  assert.equal((await get()).owner_tenant_user_id, manager);
});

test("trusted configured intent updates are audited and cannot be downgraded by later acknowledgements", async () => {
  const d = local.db;
  const lead = (
    await d.query(
      "select * from leads where tenant_id=$1 and closed_at is null order by id limit 1",
      [tenant],
    )
  ).rows[0];
  const { readFile } = await import("node:fs/promises");
  const pack = JSON.parse(
    await readFile("docs_chat/examples/new-business.pack.json", "utf8"),
  );
  pack.crm = {
    intentPriorities: { question: 1, booking: 3, thanks: 0 },
    hotIntents: ["booking"],
  };
  await d.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json,published_at,published_by) values($1,$2,1,'published',$3,now(),'lead-staff')",
    [tenant, lead.brand_id, JSON.stringify(pack)],
  );
  await command(
    "lead.edit",
    { leadId: lead.id, version: lead.version, intent: "booking" },
    "intent-booking",
  );
  const saved = (
    await d.query(
      "select version,intent from leads where tenant_id=$1 and id=$2",
      [tenant, lead.id],
    )
  ).rows[0];
  assert.equal(saved.intent, "booking");
  await command(
    "lead.edit",
    { leadId: lead.id, version: saved.version, intent: "thanks" },
    "intent-thanks",
  );
  assert.equal(
    (
      await d.query("select intent from leads where tenant_id=$1 and id=$2", [
        tenant,
        lead.id,
      ])
    ).rows[0].intent,
    "booking",
  );
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from lead_events where tenant_id=$1 and lead_id=$2 and kind='intent'",
        [tenant, lead.id],
      )
    ).rows[0].n,
    1,
  );
});

test("Shopify payment progression uses current hold and newest generation; incomplete latest facts never fall back to older paid data", async () => {
  const d = local.db;
  const event = {
    ...message,
    messageId: 1300,
    conversationId: 1300,
    contactId: 1300,
    channelKind: "whatsapp",
  };
  await capture(d, event, "events", {});
  const get = () =>
    d
      .query(
        "select * from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=1300)",
        [tenant],
      )
      .then((r) => r.rows[0]);
  let lead = await get();
  const converted = await command(
    "contact.convert",
    { contactId: lead.contact_id, name: "Synthetic Shopify boundary" },
    "shopify-customer",
  );
  const connection = (
    await d.query(
      "insert into shopify_connections(tenant_id,shop_gid,canonical_domain,app_ref,environment,import_created_at_cutoff) values($1,'gid://shopify/Shop/991','chat-fixture.myshopify.com','synthetic-chat','production','2026-10-01') returning id",
      [tenant],
    )
  ).rows[0].id;
  const order = (
    await d.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,source,financial_management,order_status) values($1,$2,'CHAT-SHOPIFY','chat-shopify-token','shopify','external_shopify','draft') returning id",
      [tenant, converted.customerId],
    )
  ).rows[0].id;
  // Fixture-only capability installs a released record; no importer/release acceptance claim.
  await d.query("begin");
  try {
    await d.query(
      "insert into shopify_release_capabilities values(pg_backend_pid(),txid_current(),$1,$2)",
      [tenant, order],
    );
    await d.query(
      "update orders set order_status='confirmed' where tenant_id=$1 and id=$2",
      [tenant, order],
    );
    await d.query("commit");
  } catch (error) {
    await d.query("rollback");
    throw error;
  }
  const source = (
    await d.query(
      "insert into shopify_source_orders(tenant_id,connection_id,shop_gid,order_gid,order_id) values($1,$2,'gid://shopify/Shop/991','gid://shopify/Order/991',$3) returning id",
      [tenant, connection, order],
    )
  ).rows[0].id;
  const job = (
    await d.query(
      "insert into shopify_sync_jobs(tenant_id,connection_id,order_gid) values($1,$2,'gid://shopify/Order/991') returning id",
      [tenant, connection],
    )
  ).rows[0].id;
  const revision = async (generation, payment, id) => {
    const r = (
      await d.query(
        "insert into shopify_source_revisions(id,tenant_id,source_order_id,job_id,generation,source_updated_at,observed_at,source_digest,sealed_source,review_reasons,completeness) values($1,$2,$3,$4,$5,'2026-10-01','2026-10-01',$6,'{}','[]',$7) returning id",
        [
          id,
          tenant,
          source,
          job,
          generation,
          "b".repeat(64),
          payment ? "complete" : "partial",
        ],
      )
    ).rows[0].id;
    if (payment)
      await d.query(
        "insert into shopify_commercial_details(tenant_id,source_order_id,revision_id,details,raw_expires_at) values($1,$2,$3,$4,'2026-10-02')",
        [
          tenant,
          source,
          r,
          JSON.stringify({
            cancelledAt: null,
            payment: {
              availability: "available",
              status: payment,
              validation: "source_consistent",
              productionHeld: false,
            },
          }),
        ],
      );
    return r;
  };
  const first = await revision(
    1,
    "PAID",
    "ffffffff-ffff-4fff-8fff-fffffffffff1",
  );
  lead = await get();
  await command(
    "lead.record",
    { leadId: lead.id, version: lead.version, orderId: order },
    "shopify-link",
  );
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "in_progress"); // absent state is held
  await d.query(
    "insert into shopify_operational_state(tenant_id,source_order_id,latest_revision_id,accepted_revision_id,held) values($1,$2,$3,$3,true)",
    [tenant, source, first],
  );
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "in_progress");
  await d.query(
    "update shopify_operational_state set held=false where tenant_id=$1 and source_order_id=$2",
    [tenant, source],
  );
  await revision(2, "PENDING", "00000000-0000-4000-8000-000000000002");
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "in_progress");
  await revision(3, null, "00000000-0000-4000-8000-000000000003");
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "in_progress");
  await revision(4, "PAID", "00000000-0000-4000-8000-000000000004");
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "won");
});

test("conversion racing the existing platform customer insert waits for its canonical unique key and reuses the committed customer", async () => {
  const d = local.db,
    blocker = await local.connect();
  await capture(
    d,
    {
      ...message,
      messageId: 1400,
      conversationId: 1400,
      contactId: 1400,
      channelKind: "whatsapp",
    },
    "events",
    {},
  );
  const person = (
    await d.query(
      "select contact_id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=1400",
      [tenant],
    )
  ).rows[0].contact_id;
  await blocker.query("begin");
  const customer = (
    await blocker.query(
      "insert into customers(tenant_id,name,phone,normalized_phone_e164) values($1,'Existing platform winner','+919555555555','+919555555555') returning id",
      [tenant],
    )
  ).rows[0].id;
  const pid = (await d.query("select pg_backend_pid() pid")).rows[0].pid;
  const pending = command(
    "contact.convert",
    {
      contactId: person,
      name: "Do not overwrite",
      phone: "+919555555555",
      phoneE164: "+919555555555",
    },
    "customer-platform-race",
  );
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      waiting = (
        await blocker.query(
          "select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",
          [pid],
        )
      ).rows[0]?.waiting;
      if (waiting) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(
      waiting,
      true,
      "Conversion must contend with the uncommitted platform identity.",
    );
    await blocker.query("commit");
  } catch (error) {
    await blocker.query("rollback");
    await pending.catch(() => {});
    throw error;
  }
  const result = await pending;
  assert.equal(result.customerId, customer);
  assert.equal(
    (
      await d.query(
        "select count(*)::int n from customers where tenant_id=$1 and normalized_phone_e164='+919555555555'",
        [tenant],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await d.query("select name from customers where tenant_id=$1 and id=$2", [
        tenant,
        customer,
      ])
    ).rows[0].name,
    "Existing platform winner",
  );
});

test("an explicitly linked native booking blocks inactivity while NEW, then only confirmed native state advances it to booked", async () => {
  const d = local.db,
    event = {
      ...message,
      messageId: 1500,
      conversationId: 1500,
      contactId: 1500,
      channelKind: "whatsapp",
    };
  await capture(d, event, "events", {});
  const get = () =>
    d
      .query(
        "select * from leads where tenant_id=$1 and conversation_id=(select id from chat_conversations where tenant_id=$1 and chatwoot_conversation_id=1500)",
        [tenant],
      )
      .then((r) => r.rows[0]);
  let lead = await get();
  const converted = await command(
    "contact.convert",
    { contactId: lead.contact_id, name: "Synthetic booking customer" },
    "booking-customer",
  );
  const booking = (
    await d.query(
      "insert into laundry_pickup_requests(tenant_id,customer_id,requested_date,requested_window,source) values($1,$2,current_date,'Synthetic window','manual') returning id",
      [tenant, converted.customerId],
    )
  ).rows[0].id;
  lead = await get();
  await command(
    "lead.record",
    {
      leadId: lead.id,
      version: lead.version,
      bookingType: "laundry_pickup_request",
      bookingId: booking,
    },
    "booking-link",
  );
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "new");
  await d.query(
    "update laundry_pickup_requests set status='SCHEDULED',scheduled_at=now() where tenant_id=$1 and id=$2",
    [tenant, booking],
  );
  await refresh({ leadId: lead.id });
  assert.equal((await get()).stage, "booked");
});
