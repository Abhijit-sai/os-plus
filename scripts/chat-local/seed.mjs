import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { encryptChatSecret } from "../../src/features/chat/secrets.ts";
export const id = (n) =>
  "81000000-0000-4000-8000-" + String(n).padStart(12, "0");
export const fixtures = {
  A: id(1),
  B: id(2),
  disabled: id(3),
  brand: id(10),
  workspace: id(11),
  customer: id(30),
  order: id(40),
};
export async function seed(db, s) {
  await db.query("begin");
  try {
    const exists = await db.query("select id from tenants where id=$1", [
      fixtures.A,
    ]);
    if (exists.rowCount) {
      await db.query("rollback");
      return;
    }
    for (const [n, name] of [
      [1, "Local QA A"],
      [2, "Local QA B"],
      [3, "Local QA Disabled"],
    ]) {
      await db.query(
        "insert into tenants(id,name,slug,store_name) values($1,$2,$3,$2)",
        [id(n), name, "chat-local-" + n],
      );
      await db.query(
        "insert into tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at) select $1,id,true,now() from vertical_definitions where key='boutique'",
        [id(n)],
      );
    }
    const users = [
      ["owner-a", 1, "owner_admin"],
      ["owner-a", 2, "owner_admin"],
      ["owner-b", 2, "owner_admin"],
      ["manager-a", 1, "manager"],
      ["viewer-a", 1, "viewer"],
      ["finance-a", 1, "finance"],
    ];
    for (const [name, tenant, role] of users)
      await db.query(
        "insert into tenant_users(tenant_id,email,role,status) values($1,$2,$3,'active')",
        [id(tenant), name + "+clerk_test@example.com", role],
      );
    // Service-context API checks use a separate synthetic actor; no Clerk session is fabricated.
    for (const [actor, tenant, role] of [
      ["local-api-owner-a", 1, "owner_admin"],
      ["local-api-owner-b", 2, "owner_admin"],
      ["local-api-manager-a", 1, "manager"],
    ])
      await db.query(
        "insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,$2,$3,'active')",
        [id(tenant), actor, role],
      );
    for (const tenant of [1, 2]) {
      await db.query(
        "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
        [id(tenant)],
      );
      await db.query("insert into chat_settings(tenant_id) values($1)", [
        id(tenant),
      ]);
      for (const [n, code] of [
        [20, "north"],
        [21, "south"],
      ])
        await db.query(
          "insert into tenant_locations(id,tenant_id,code,name) values($1,$2,$3,$4)",
          [
            id(n + tenant * 100),
            id(tenant),
            code,
            code === "north" ? "North branch" : "South branch",
          ],
        );
    }
    await db.query(
      "insert into chat_brands(id,tenant_id,name,slug,persona_name) values($1,$2,'Local Inquiry Brand','local-inquiry','Demo assistant')",
      [id(10), id(1)],
    );
    for (const n of [120, 121])
      await db.query(
        "insert into chat_brand_locations(tenant_id,brand_id,location_id) values($1,$2,$3)",
        [id(1), id(10), id(n)],
      );
    const oldKeys = process.env.CHAT_SECRETS_KEYS,
      oldActive = process.env.CHAT_SECRETS_ACTIVE_VERSION;
    process.env.CHAT_SECRETS_KEYS = JSON.stringify({ v1: s.chatKey });
    process.env.CHAT_SECRETS_ACTIVE_VERSION = "v1";
    let encrypted;
    try {
      encrypted = encryptChatSecret("synthetic-local-no-provider-token", {
        tenantId: id(1),
        workspaceId: id(11),
        purpose: "account_token",
      });
    } finally {
      if (oldKeys === undefined) delete process.env.CHAT_SECRETS_KEYS;
      else process.env.CHAT_SECRETS_KEYS = oldKeys;
      if (oldActive === undefined)
        delete process.env.CHAT_SECRETS_ACTIVE_VERSION;
      else process.env.CHAT_SECRETS_ACTIVE_VERSION = oldActive;
    }
    await db.query(
      "insert into chat_workspaces(id,tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,$2,'https://chatwoot.example.invalid',901,$3,$4,$5,'active')",
      [
        id(11),
        id(1),
        randomBytes(24).toString("base64url"),
        createHash("sha256").update(randomBytes(32)).digest("hex"),
        encrypted,
      ],
    );
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,default_location_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,$4,901,'website','Synthetic website inbox')",
      [id(1), id(11), id(10), id(120)],
    );
    const pack = JSON.parse(
      await readFile(
        new URL(
          "../../docs_chat/examples/new-business.pack.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "insert into chat_knowledge_packs(tenant_id,brand_id,version,pack_json) values($1,$2,1,$3::jsonb)",
      [id(1), id(10), JSON.stringify(pack)],
    );
    await db.query(
      "insert into customer_statuses(id,tenant_id,name,sort_order) values($1,$2,'In preparation',1),($3,$2,'Ready',2)",
      [id(50), id(1), id(51)],
    );
    await db.query(
      "insert into item_types(id,tenant_id,name) values($1,$2,'QA garment')",
      [id(31), id(1)],
    );
    await db.query(
      "insert into workflows(id,tenant_id,name,item_type_id,is_default) values($1,$2,'QA two-stage workflow',$3,true)",
      [id(32), id(1), id(31)],
    );
    await db.query("update item_types set default_workflow_id=$1 where id=$2", [
      id(32),
      id(31),
    ]);
    await db.query(
      "insert into workgroups(id,tenant_id,name) values($1,$2,'QA workgroup')",
      [id(33), id(1)],
    );
    await db.query(
      "insert into workers(id,tenant_id,name,primary_workgroup_id) values($1,$2,'Synthetic QA worker',$3)",
      [id(34), id(1), id(33)],
    );
    await db.query(
      "insert into worker_workgroups(tenant_id,worker_id,workgroup_id) values($1,$2,$3)",
      [id(1), id(34), id(33)],
    );
    for (const n of [0, 1]) {
      await db.query(
        "insert into stage_master(id,tenant_id,name,default_customer_status_id) values($1,$2,$3,$4)",
        [id(35 + n), id(1), n ? "QA finish" : "QA prepare", id(50 + n)],
      );
      await db.query(
        "insert into stage_workgroups(tenant_id,stage_master_id,workgroup_id) values($1,$2,$3)",
        [id(1), id(35 + n), id(33)],
      );
      await db.query(
        "insert into workflow_stages(id,tenant_id,workflow_id,stage_master_id,sequence_number,customer_status_id) values($1,$2,$3,$4,$5,$6)",
        [id(37 + n), id(1), id(32), id(35 + n), n + 1, id(50 + n)],
      );
    }
    await db.query(
      "insert into payment_modes(id,tenant_id,name) values($1,$2,'QA cash')",
      [id(39), id(1)],
    );
    await db.query(
      "insert into customers(id,tenant_id,name,notes) values($1,$2,'Synthetic QA Customer','Local-only, no contact channel')",
      [id(30), id(1)],
    );
    await db.query(
      "insert into customer_measurements(id,tenant_id,customer_id,item_type_id,measurement_data_json,is_default) values($1,$2,$3,$4,$5::jsonb,true)",
      [
        id(52),
        id(1),
        id(30),
        id(31),
        JSON.stringify({ chest: "36", length: "24" }),
      ],
    );
    await db.query(
      "insert into orders(id,tenant_id,customer_id,order_number,tracking_token,subtotal,total_amount,promised_delivery_date) values($1,$2,$3,'QA-SEED-001','local-qa-synthetic-tracking',2000,2000,current_date+7)",
      [id(40), id(1), id(30)],
    );
    for (const n of [0, 1]) {
      await db.query(
        "insert into order_items(id,tenant_id,order_id,item_type_id,name,unit_price,final_price,workflow_id,customer_status_id,customer_measurement_id) values($1,$2,$3,$4,$5,1000,1000,$6,$7,$8)",
        [
          id(41 + n),
          id(1),
          id(40),
          id(31),
          "QA garment " + (n + 1),
          id(32),
          id(50),
          id(52),
        ],
      );
      await db.query(
        "insert into item_workflow_instances(id,tenant_id,order_item_id,workflow_id) values($1,$2,$3,$4)",
        [id(60 + n), id(1), id(41 + n), id(32)],
      );
      for (const k of [0, 1])
        await db.query(
          "insert into item_stage_instances(id,tenant_id,workflow_instance_id,order_item_id,workflow_stage_id,stage_master_id,sequence_number,status,customer_status_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            id(70 + n * 2 + k),
            id(1),
            id(60 + n),
            id(41 + n),
            id(37 + k),
            id(35 + k),
            k + 1,
            k ? "not_started" : "ready_to_start",
            id(50 + k),
          ],
        );
      await db.query(
        "update item_workflow_instances set current_stage_instance_id=$1 where id=$2",
        [id(70 + n * 2), id(60 + n)],
      );
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
