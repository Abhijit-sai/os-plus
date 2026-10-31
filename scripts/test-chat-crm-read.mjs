import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local;
const a = "60000000-0000-4000-8000-000000000001",
  b = "60000000-0000-4000-8000-000000000002";
const ctx = (tenantId = a, who = "owner") => ({
  tenantId,
  actor: { type: "USER", id: "crm-" + who },
  source: "OS_PLUS_UI",
  correlationId: "crm-read-test",
});
const read = (view, input = {}, context = ctx()) =>
  local.db
    .query("select chat_crm_read($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      view,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
before(
  async () => {
    local = await startChatDatabase();
    for (const [index, t] of [a, b].entries()) {
      const d = local.db,
        account = 100 + index;
      await d.query(
        "insert into tenants(id,name,store_name,slug) values($1,'CRM fixture','CRM fixture',$2)",
        [t, "crm-" + index],
      );
      await d.query(
        "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
        [t],
      );
      await d.query("insert into chat_settings(tenant_id) values($1)", [t]);
      for (const [who, role] of [
        ["owner", "owner_admin"],
        ["manager", "manager"],
        ["viewer", "viewer"],
        ["finance", "finance"],
      ]) {
        await d.query(
          "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')",
          [t, "crm-" + who, who + "@example.invalid", who, role],
        );
      }
      const w = (
        await d.query(
          "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',$2,$3,$4,'gcm1.v1.fixture','active') returning id",
          [t, account, String(index).repeat(32), "a".repeat(64)],
        )
      ).rows[0].id;
      const brand = (
        await d.query(
          "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'CRM Brand','crm','Assistant') returning id",
          [t],
        )
      ).rows[0].id;
      const channel = (
        await d.query(
          "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,20,'website','Website') returning id",
          [t, w, brand],
        )
      ).rows[0].id;
      for (let i = 1; i <= (index === 0 ? 54 : 3); i++) {
        await d.query("select chat_capture($1::jsonb,$2,$3::jsonb)", [
          JSON.stringify({
            tenantId: t,
            actor: { type: "WEBHOOK", id: "chatwoot" },
            source: "WEBHOOK",
            correlationId: "crm-fixture",
          }),
          "events",
          JSON.stringify({
            workspaceId: w,
            secretHash: "a".repeat(64),
            channelId: channel,
            identity: {
              displayName: "Sensitive person " + i,
              sourceId: "visitor-" + i,
            },
            message: {
              messageId: i,
              accountId: account,
              inboxId: 20,
              conversationId: i,
              contactId: i,
              status: "open",
              channelKind: "website",
              author: "customer",
              private: false,
              content: "Private person +919876543210",
              contentType: "text",
              createdAt: "2026-10-21T10:00:00Z",
              staffUserId: null,
              attachments: [],
            },
          }),
        ]);
      }
    }
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
test("CRM read paginates the entire selected tenant with exact counters, stable rows and no tenant override", async () => {
  const first = await read("leads", { page: 1 });
  assert.equal(first.total, 54);
  assert.equal(first.items.length, 50);
  assert.equal(first.counters.open, 54);
  assert.equal(first.counters.awaitingFirstReply, 54);
  const second = await read("leads", { page: 2 });
  assert.equal(second.items.length, 4);
  assert.equal(
    new Set([...first.items, ...second.items].map((x) => x.id)).size,
    54,
  );
  assert.equal((await read("leads", {}, ctx(b))).total, 3);
  const missing = await read("lead", {
    id: (await read("leads", {}, ctx(b))).items[0].id,
  });
  assert.equal(missing.item, null);
});

test("viewer/finance are denied until granted; PII, reports and filter authority remain independent", async () => {
  await assert.rejects(read("leads", {}, ctx(a, "viewer")));
  await assert.rejects(read("leads", {}, ctx(a, "finance")));
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:view',true)",
    [a],
  );
  const masked = await read("leads", {}, ctx(a, "viewer"));
  assert.equal(masked.permissions.pii, false);
  assert.equal(masked.permissions.manage, false);
  assert.equal(masked.permissions.reports, false);
  for (const word of [
    "Sensitive person",
    "Private person",
    "9876543210",
    "gcm1",
    "crm-owner",
  ])
    assert.equal(JSON.stringify(masked).includes(word), false, word);
  await assert.rejects(read("performance", {}, ctx(a, "manager")));
  await assert.rejects(read("leads", { tenantId: b }, ctx(a, "viewer")));
  await assert.rejects(read("leads", { pii: true }, ctx(a, "viewer")));
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:pii',true)",
    [a],
  );
  const unmasked = await read("leads", {}, ctx(a, "viewer"));
  assert.equal(unmasked.permissions.pii, true);
  assert.equal(
    unmasked.items[0].display_name.startsWith("Sensitive person"),
    true,
  );
  assert.equal(unmasked.permissions.manage, false);
  await local.db.query(
    "update chat_role_permissions set allowed=false where tenant_id=$1 and role='viewer' and permission='leads:view'",
    [a],
  );
  await assert.rejects(read("leads", {}, ctx(a, "viewer")));
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [a],
  );
  await assert.rejects(read("leads"));
  await local.db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [a],
  );
});

test("production read adapter uses real guard and SQL then serializes only safe DTOs for granted viewer", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const base = postgresAdapter(local.db),
    adapter = {
      ...base,
      rpc: async (name, args) => {
        assert.equal(name, "chat_crm_read");
        try {
          return {
            data: await read(args.p_view, args.p_input, args.p_context),
            error: null,
          };
        } catch (error) {
          return { data: null, error };
        }
      },
    };
  const membership = (
    await local.db.query(
      "select * from tenant_users where tenant_id=$1 and clerk_user_id='crm-viewer'",
      [a],
    )
  ).rows[0];
  const context = { tenant: { id: a, status: "active" }, membership };
  const guard = loadServerModule("src/features/chat/module.ts", {
    "@/lib/tenant/context": { requireTenantContext: async () => context },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => adapter },
    "./permissions": await import("../src/features/chat/permissions.ts"),
  });
  const queries = loadServerModule("src/features/leads/queries.ts", {
    zod: await import("zod"),
    "../chat/module": guard,
    "@/core/command-context/server": loadServerModule(
      "src/core/command-context/server.ts",
      {},
    ),
    "./pii": await import("../src/features/leads/pii.ts"),
    "./read-schemas": await import("../src/features/leads/read-schemas.ts"),
    "./transport": await import("../src/features/leads/transport.ts"),
  });
  const previous = process.env.CHAT_FOUNDATION_ENABLED;
  process.env.CHAT_FOUNDATION_ENABLED = "true";
  try {
    await assert.rejects(queries.getLeadInbox({}));
    await local.db.query(
      "update chat_role_permissions set allowed=(permission='leads:view') where tenant_id=$1 and role='viewer'",
      [a],
    );
    const dto = await queries.getLeadInbox({});
    assert.equal(dto.total, 54);
    assert.equal(dto.items[0].name, "Contact hidden");
    for (const word of [
      "Sensitive person",
      "Private person",
      "9876543210",
      "gcm1",
      "api_token_enc",
      "raw_json",
      "clerk_user_id",
    ])
      assert.equal(JSON.stringify(dto).includes(word), false, word);
    await assert.rejects(queries.getChatEntry());
    context.membership = {
      ...membership,
      role: "manager",
      clerk_user_id: "crm-manager",
    };
    assert.equal(
      (await queries.getLeadInbox({})).items[0].name.startsWith(
        "Sensitive person",
      ),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.CHAT_FOUNDATION_ENABLED;
    else process.env.CHAT_FOUNDATION_ENABLED = previous;
  }
});

test("lead detail mirrors only public conversation text and never leaks notes, metadata or transport links to read-only viewers", async () => {
  const id = (await read("leads")).items[0].id;
  const full = await read("lead", { id });
  assert.equal(full.details.messages.length, 1);
  assert.equal(
    full.details.messages[0].content,
    "Private person +919876543210",
  );
  const viewer = await read("lead", { id }, ctx(a, "viewer"));
  assert.equal(viewer.details.messages[0].content, null);
  assert.equal(viewer.details.chat, null);
  assert.equal(JSON.stringify(viewer).includes("9876543210"), false);
  assert.equal(full.details.chat.accountId, 100);
  assert.equal((await read("lead", { id }, ctx(b))).item, null);
});

test("contact records and exact customer candidates stay tenant-scoped; native customer/orders require management role", async () => {
  const list = await read("contacts");
  assert.equal(list.total, 54);
  assert.equal(list.items.length, 50);
  const contactId = list.items[0].id;
  const detail = await read("contact", { id: contactId });
  assert.equal(detail.item.id, contactId);
  assert.equal(detail.details.identities.length, 2);
  assert.equal((await read("contact", { id: contactId }, ctx(b))).item, null);
  await local.db.query("select chat_lead_command($1::jsonb,$2,$3::jsonb)", [
    JSON.stringify({
      ...ctx(),
      idempotencyKey: "61000000-0000-4000-8000-000000000001",
    }),
    "contact.convert",
    JSON.stringify({
      contactId,
      name: "New CRM customer",
      phone: null,
      phoneE164: null,
      email: null,
    }),
  ]);
  const linked = await read("contact", { id: contactId });
  assert.equal(linked.details.customer.name, "New CRM customer");
  await local.db.query(
    "update chat_role_permissions set allowed=true where tenant_id=$1 and role='viewer'",
    [a],
  );
  const viewer = await read("contact", { id: contactId }, ctx(a, "viewer"));
  assert.equal(viewer.details.customer, null);
  assert.deepEqual(viewer.details.orders, []);
  assert.equal(viewer.permissions.manage, false);
});

test("owner performance uses full selected population, first human clock and public mapped staff replies without private/bot inflation", async () => {
  const id = (await read("leads")).items[0].id;
  const lead = (
    await local.db.query("select * from leads where tenant_id=$1 and id=$2", [
      a,
      id,
    ])
  ).rows[0];
  const staff = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and clerk_user_id='crm-manager'",
      [a],
    )
  ).rows[0].id;
  await local.db.query(
    "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,400)",
    [a, staff],
  );
  await local.db.query(
    "update leads set owner_tenant_user_id=$3,first_response_at=first_customer_at+interval '10 seconds',first_human_response_at=first_customer_at+interval '30 seconds',stage='won',closed_at=now() where tenant_id=$1 and id=$2",
    [a, id, staff],
  );
  for (const [msg, author, isPrivate] of [
    [1000, "staff", false],
    [1001, "staff", true],
    [1002, "bot", false],
  ]) {
    await local.db.query(
      "insert into chat_messages(tenant_id,conversation_id,chatwoot_message_id,author,private,content_type,content,staff_chatwoot_user_id,created_at) values($1,$2,$3,$4,$5,'text','Report fixture',$6,now())",
      [
        a,
        lead.conversation_id,
        msg,
        author,
        isPrivate,
        author === "staff" ? 400 : null,
      ],
    );
  }
  const report = (await read("performance")).performance;
  assert.equal(report.medianFirstHumanSeconds, 30);
  assert.equal(report.publicStaffReplies, 1);
  assert.equal(report.people.find((p) => p.id === staff).replies, 1);
  assert.equal(report.people.find((p) => p.id === staff).won, 1);
  assert.equal(report.people.find((p) => p.id === staff).afterHours, null);
  assert.equal(report.peopleCount, 2);
  await assert.rejects(read("performance", {}, ctx(a, "manager")));
  await assert.rejects(read("performance", {}, ctx(a, "viewer")));
});

test("SQL reporting schedule matches local timezone windows; no schedule is unknown and private replies stay excluded", async () => {
  const { readFile } = await import("node:fs/promises");
  const pack = JSON.parse(
    await readFile("docs_chat/examples/new-business.pack.json", "utf8"),
  );
  const schedule = {
    timezone: "Asia/Kolkata",
    intervals: [{ day: 1, startMinute: 540, endMinute: 1080 }],
  };
  pack.crm = { intentPriorities: {}, reportingSchedule: schedule };
  const { parseKnowledgePack } =
    await import("../src/features/chat/knowledge-pack.ts");
  const valid = parseKnowledgePack(pack);
  const brand = (
    await local.db.query("select id from chat_brands where tenant_id=$1", [a])
  ).rows[0].id;
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json,published_at,published_by) values($1,$2,1,'published',$3,now(),'fixture')",
    [a, brand, JSON.stringify(valid)],
  );
  await local.db.query(
    "update chat_messages set created_at='2026-10-19T03:30:00Z' where tenant_id=$1 and chatwoot_message_id=1000",
    [a],
  );
  let report = (await read("performance")).performance;
  assert.equal(report.afterHoursUnknownReplies, 0);
  assert.equal(report.people.find((p) => p.name === "manager").afterHours, 0);
  await local.db.query(
    "update chat_messages set created_at='2026-10-19T12:30:00Z' where tenant_id=$1 and chatwoot_message_id=1000",
    [a],
  );
  report = (await read("performance")).performance;
  assert.equal(report.people.find((p) => p.name === "manager").afterHours, 1);
  await local.db.query(
    "update chat_knowledge_packs set status='archived' where tenant_id=$1 and status='published'",
    [a],
  );
  delete pack.crm.reportingSchedule;
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json,published_at,published_by) values($1,$2,2,'published',$3,now(),'fixture')",
    [a, brand, JSON.stringify(parseKnowledgePack(pack))],
  );
  assert.equal(
    (await read("performance")).performance.afterHoursUnknownReplies,
    1,
  );
});

test("panel lookup resolves only an authorised tenant account/inbox/conversation and viewers cannot use it", async () => {
  const expected = (
    await local.db.query(
      "select l.id from leads l join chat_conversations c on c.tenant_id=l.tenant_id and c.id=l.conversation_id where l.tenant_id=$1 and c.chatwoot_conversation_id=1",
      [a],
    )
  ).rows[0].id;
  const input = { accountId: 100, inboxId: 20, conversationId: 1 };
  assert.equal((await read("panel", input)).leadId, expected);
  assert.equal(
    (await read("panel", { ...input, accountId: 101 })).leadId,
    null,
  );
  assert.equal((await read("panel", { ...input, inboxId: 999 })).leadId, null);
  await assert.rejects(read("panel", input, ctx(a, "viewer")));
  assert.equal((await read("panel", input, ctx(b))).leadId, null);
});

test("note-only UI commands preserve automatic owner provenance; explicit unassignment remains audited and retry-safe", async () => {
  const { buildLeadEdit } =
    await import("../src/features/leads/editor-state.ts");
  const { projectLead } = await import("../src/features/leads/pii.ts");
  const original = (await read("leads")).items[0];
  const staff = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='manager'",
      [a],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set owner_tenant_user_id=$2,owner_source='auto' where tenant_id=$1 and id=$3",
    [a, staff, original.id],
  );
  const dto = projectLead((await read("lead", { id: original.id })).item, {
    pii: true,
    now: new Date().toISOString(),
  });
  const request = buildLeadEdit(dto, {
    stage: dto.stage,
    ownerId: staff,
    notes: "Local editor note",
    lostReason: "",
  });
  const context = {
    ...ctx(),
    idempotencyKey: "61000000-0000-4000-8000-000000000021",
  };
  const command = async (r, c) =>
    (
      await local.db.query(
        "select chat_lead_command($1::jsonb,$2,$3::jsonb) result",
        [JSON.stringify(c), r.action, JSON.stringify(r.input)],
      )
    ).rows[0].result;
  const saved = await command(request, context);
  assert.deepEqual(await command(request, context), saved);
  let row = (await local.db.query("select * from leads where id=$1", [dto.id]))
    .rows[0];
  assert.equal(row.owner_source, "auto");
  assert.equal(row.owner_tenant_user_id, staff);
  const next = projectLead((await read("lead", { id: dto.id })).item, {
    pii: true,
    now: new Date().toISOString(),
  });
  await command(
    buildLeadEdit(next, {
      stage: next.stage,
      ownerId: "",
      notes: "Unassign deliberately",
      lostReason: "",
    }),
    { ...ctx(), idempotencyKey: "61000000-0000-4000-8000-000000000022" },
  );
  row = (await local.db.query("select * from leads where id=$1", [dto.id]))
    .rows[0];
  assert.equal(row.owner_source, "manual");
  assert.equal(row.owner_tenant_user_id, null);
});

test("Needs a look pages include replied unassigned and handoff leads and preserve the full report scope", async () => {
  const scope = (await read("leads")).items[0];
  const rows = (
    await local.db.query(
      "select id from leads where tenant_id=$1 order by id limit 2",
      [a],
    )
  ).rows;
  await local.db.query(
    "update leads set last_reply_at=last_customer_at, first_response_at=first_customer_at where id=any($1::uuid[])",
    [rows.map((r) => r.id)],
  );
  const manager = (
    await local.db.query(
      "select id from tenant_users where tenant_id=$1 and role='manager'",
      [a],
    )
  ).rows[0].id;
  await local.db.query(
    "update leads set handoff=true, owner_tenant_user_id=$2 where id=$1",
    [rows[1].id, manager],
  );
  const filters = { brandId: scope.brand_id, channelId: scope.channel_id };
  const report = (await read("performance", filters)).performance;
  const page = await read("leads", { ...filters, state: "needs_look" });
  const next = await read("leads", {
    ...filters,
    state: "needs_look",
    page: 2,
  });
  assert.equal(page.total, report.needsLookCount);
  assert.ok(page.total > 50);
  const all = [...page.items, ...next.items];
  for (const row of rows) assert.ok(all.some((x) => x.id === row.id));
  const foreign = (await read("leads", {}, ctx(b))).items[0];
  assert.equal(
    (
      await read("leads", {
        ...filters,
        brandId: foreign.brand_id,
        state: "needs_look",
      })
    ).total,
    0,
  );
});

test("published named reporting timezones have TypeScript and real PostgreSQL parity; numeric offsets are rejected", async () => {
  const { reportingScheduleSchema, isOutsideReportingHours } =
    await import("../src/features/leads/reporting-hours.ts");
  for (const zone of [
    "utc",
    "UTC",
    "Asia/Kolkata",
    "asia/kolkata",
    "America/New_York",
    "Etc/GMT+5",
  ]) {
    const schedule = reportingScheduleSchema.parse({
      timezone: zone,
      intervals: [{ day: 1, startMinute: 540, endMinute: 1080 }],
    });
    for (const at of ["2026-10-19T03:30:00Z", "2026-10-19T14:30:00Z"]) {
      const actual = (
        await local.db.query(
          "select chat_report_after_hours($1::timestamptz,$2::jsonb) value",
          [at, JSON.stringify({ crm: { reportingSchedule: schedule } })],
        )
      ).rows[0].value;
      assert.equal(
        actual,
        isOutsideReportingHours(at, schedule),
        zone + " " + at,
      );
    }
  }
  for (const timezone of ["+05:30", "+0530", "-08:00"])
    assert.equal(
      reportingScheduleSchema.safeParse({
        timezone,
        intervals: [{ day: 1, startMinute: 0, endMinute: 60 }],
      }).success,
      false,
    );
});

test("unsent draft exposes only suggestion text and recorded knowledge version to PII readers", async () => {
  const item = (await read("leads")).items[0];
  const message = (
    await local.db.query(
      "select id from chat_messages where tenant_id=$1 and conversation_id=$2 and author='customer' order by created_at limit 1",
      [a, item.conversation_id],
    )
  ).rows[0];
  await local.db.query(
    "insert into chat_turns(tenant_id,conversation_id,trigger_message_id,mode,outcome,reply_text,knowledge_pack_version,understanding_json,models_json,error) values($1,$2,$3,'draft','drafted','Thank you for your enquiry.',3,$4,$4,'internal diagnostic')",
    [
      a,
      item.conversation_id,
      message.id,
      JSON.stringify({ private: "must not reach UI", model: "internal model" }),
    ],
  );
  const full = await read("lead", { id: item.id });
  assert.deepEqual(full.details.draft, {
    text: "Thank you for your enquiry.",
    knowledgeVersion: 3,
  });
  assert.equal(
    JSON.stringify(full.details).includes("must not reach UI"),
    false,
  );
  assert.equal(JSON.stringify(full.details).includes("internal model"), false);
  await local.db.query(
    "update chat_role_permissions set allowed=(permission='leads:view') where tenant_id=$1 and role='viewer'",
    [a],
  );
  const masked = await read("lead", { id: item.id }, ctx(a, "viewer"));
  assert.equal(masked.details.draft, null);
  assert.equal(
    JSON.stringify(masked).includes("Thank you for your enquiry."),
    false,
  );
});
