import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  state,
  ports,
  runtime,
  root,
  verifyContainer,
  connect,
  command,
  cleanEnvironment,
} from "./common.mjs";
import { fixtures, id } from "./seed.mjs";
import { loadServerModule } from "../chat-db-harness/server-adapter.mjs";
import * as permissions from "../../src/features/chat/permissions.ts";
import * as knowledge from "../../src/features/chat/knowledge-pack.ts";
import * as schemas from "../../src/features/chat/schemas.ts";
const s = await state();
await verifyContainer(s, "db");
await verifyContainer(s, "rest");
const url = "http://127.0.0.1:" + ports.gateway;
const service = createClient(url, s.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, s.anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = await connect(s);
const report = {
  at: new Date().toISOString(),
  scope:
    "Local PostgreSQL + real PostgREST/Supabase SDK; synthetic server identity, NOT Clerk/browser acceptance",
  checks: [],
};
const run = async (name, fn) => {
  await fn();
  report.checks.push({ name, passed: true });
  console.log("PASS " + name);
};
const good = async (request) => {
  const result = await request;
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
let tenant = fixtures.A,
  actor = "local-api-owner-a";
process.env.CHAT_FOUNDATION_ENABLED = "true";
const server = loadServerModule(
  path.join(root, "src/features/chat/module.ts"),
  {
    "@/lib/tenant/context": {
      requireTenantContext: async () => ({
        tenant: await good(
          service.from("tenants").select("*").eq("id", tenant).single(),
        ),
        membership: await good(
          service
            .from("tenant_users")
            .select("*")
            .eq("tenant_id", tenant)
            .eq("clerk_user_id", actor)
            .single(),
        ),
      }),
    },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => service },
    "./permissions": permissions,
  },
);
const queries = loadServerModule(
  path.join(root, "src/features/chat/queries.ts"),
  {
    zod: { z },
    "./module": server,
    "./knowledge-pack": knowledge,
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => service },
    "@/lib/auth/super-admin": {
      requireSuperAdmin: async () => {
        throw new Error("No platform session in API tests");
      },
    },
  },
);
const nativeCommands = loadServerModule(
  path.join(root, "src/features/chat/commands.ts"),
  {
    zod: { z },
    "./module": server,
    "./schemas": schemas,
    "./knowledge-pack": knowledge,
    "./connection": {
      accountClient: () => {
        throw new Error("Provider access prohibited in local QA");
      },
    },
    "@/core/command-context/server": loadServerModule(
      path.join(root, "src/core/command-context/server.ts"),
      {},
    ),
  },
);
const keys = new Map();
const commands = {
  configureChat: (request, key) => {
    if (!keys.has(key)) keys.set(key, randomUUID());
    return nativeCommands.configureChat(request, keys.get(key));
  },
};
const ctx = (key) => ({
  tenantId: fixtures.A,
  actor: { type: "USER", id: "local-api-owner-a" },
  source: "OS_PLUS_UI",
  correlationId: "local-http-qa",
  idempotencyKey: key,
});
const rpc = (context, action, input) =>
  service.rpc("chat_configure", {
    p_context: context,
    p_action: action,
    p_input: input,
  });
const prefix = "http-" + randomBytes(6).toString("hex");
let brand;
try {
  await run(
    "gateway denies unknown keys; anon cannot read secrets or invoke configuration",
    async () => {
      assert.equal((await fetch(url + "/rest/v1/chat_workspaces")).status, 401);
      assert.ok((await anon.from("chat_workspaces").select("*")).error);
      assert.ok(
        (
          await anon.rpc("chat_configure", {
            p_context: ctx(prefix),
            p_action: "brand.save",
            p_input: {},
          })
        ).error,
      );
      const forged = createClient(url, s.service, {
        global: { headers: { Authorization: "Bearer invalid" } },
        auth: { persistSession: false },
      });
      assert.ok((await forged.from("tenants").select("id")).error);
    },
  );
  await run(
    "actual server query + PostgREST returns tenant-safe secret-free DTOs",
    async () => {
      const setup = await queries.getChatSetup();
      assert.equal(setup.tenantId, fixtures.A);
      assert.equal(setup.channels[0].agent_mode, "draft");
      assert.equal(JSON.stringify(setup).includes("api_token_enc"), false);
      assert.equal(JSON.stringify(setup).includes("gcm1."), false);
      tenant = fixtures.B;
      actor = "local-api-owner-b";
      const other = await queries.getChatSetup();
      assert.equal(other.brands.length, 0);
      assert.equal(other.workspace, null);
      await assert.rejects(
        queries.getChatKnowledge({ brandId: fixtures.brand }),
        /Knowledge unavailable/,
      );
      tenant = fixtures.A;
      actor = "local-api-owner-a";
    },
  );
  await run(
    "actual server permission gate denies manager settings and disabled tenant",
    async () => {
      actor = "local-api-manager-a";
      await assert.rejects(queries.getChatSetup(), /Chat access/);
      await server.requireChatPermission("leads:manage");
      actor = "local-api-owner-a";
      process.env.CHAT_FOUNDATION_ENABLED = "false";
      await assert.rejects(queries.getChatSetup(), /not available/);
      process.env.CHAT_FOUNDATION_ENABLED = "true";
      assert.equal(await server.isTenantChatEnabled(fixtures.disabled), false);
    },
  );
  await run(
    "HTTP concurrent command replay creates one brand and one audit event",
    async () => {
      const request = {
        action: "brand.save",
        input: {
          name: "HTTP QA " + prefix,
          slug: prefix,
          personaName: "Synthetic assistant",
        },
      };
      const results = await Promise.all([
        commands.configureChat(request, prefix),
        commands.configureChat(request, prefix),
      ]);
      assert.equal(results[0].id, results[1].id);
      brand = results[0].id;
      const events = await good(
        service
          .from("domain_events")
          .select("id")
          .eq("tenant_id", fixtures.A)
          .eq("aggregate_id", brand),
      );
      assert.equal(events.length, 1);
    },
  );
  await run(
    "HTTP denies foreign branch and foreign actor; audit failure rolls back writes",
    async () => {
      assert.ok(
        (
          await rpc(ctx(prefix + "-foreign"), "branch.map", {
            brandId: brand,
            locationId: id(220),
          })
        ).error,
      );
      assert.ok(
        (
          await rpc(
            { ...ctx(prefix + "-actor"), tenantId: fixtures.B },
            "brand.save",
            { name: "Bad", slug: prefix + "-bad", personaName: "Bad" },
          )
        ).error,
      );
      const failed = await rpc(
        { ...ctx(prefix + "-rollback"), correlationId: "" },
        "brand.save",
        {
          name: "Rollback",
          slug: prefix + "-rollback",
          personaName: "Synthetic",
        },
      );
      assert.ok(failed.error);
      assert.equal(
        (
          await good(
            service
              .from("chat_brands")
              .select("id")
              .eq("slug", prefix + "-rollback"),
          )
        ).length,
        0,
      );
    },
  );
  await run(
    "HTTP knowledge save, validation, publication and lost-response replay",
    async () => {
      for (const n of [120, 121])
        await commands.configureChat(
          {
            action: "branch.map",
            input: { brandId: brand, locationId: id(n) },
          },
          prefix + "-map" + n,
        );
      const pack = JSON.parse(
        await readFile(
          path.join(root, "docs_chat/examples/new-business.pack.json"),
          "utf8",
        ),
      );
      pack.areas = [
        { locationCode: "north", served: [], postalCodes: [] },
        { locationCode: "south", served: [], postalCodes: [] },
      ];
      const revisions = await Promise.all(
        [0, 1].map((n) =>
          commands.configureChat(
            { action: "pack.save", input: { brandId: brand, pack } },
            prefix + "-pack" + n,
          ),
        ),
      );
      assert.notEqual(revisions[0].id, revisions[1].id);
      const publish = {
        action: "pack.publish",
        input: { id: revisions[0].id },
      };
      const first = await commands.configureChat(publish, prefix + "-publish");
      const replay = await commands.configureChat(publish, prefix + "-publish");
      assert.equal(first.id, replay.id);
      const loaded = await queries.getChatKnowledge({
        brandId: brand,
        id: first.id,
      });
      assert.equal(loaded.revision.pack_json.schemaVersion, 1);
      assert.ok(
        (
          await service
            .from("chat_knowledge_packs")
            .update({ pack_json: {} })
            .eq("id", first.id)
        ).error,
      );
    },
  );
  await run("existing Boutique real-API regression smokes", async () => {
    const env = {
      ...cleanEnvironment(),
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: s.service,
      OS_PLUS_PAYMENT_INTEGRITY_DB_SMOKE: "1",
      OS_PLUS_WORKFLOW_STAGE_DB_SMOKE: "1",
      OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE: "1",
      OS_PLUS_SMOKE_TENANT_ID: fixtures.A,
      OS_PLUS_SMOKE_FOREIGN_TENANT_ID: fixtures.B,
    };
    for (const file of [
      "smoke-payment-integrity.mjs",
      "smoke-workflow-stage-concurrency.mjs",
      "smoke-existing-order-add-items.mjs",
    ]) {
      const output = await command(
        process.execPath,
        [path.join(root, "scripts", file)],
        { env, cwd: runtime },
      );
      await writeFile(path.join(runtime, file + ".log"), output);
      console.log(output);
    }
  });
  await run(
    "actual pg_dump restore into separate local database preserves every public table",
    async () => {
      const container = await verifyContainer(s, "db");
      const inventory = async (client) => {
        const tables = (
          await client.query(
            "select tablename from pg_tables where schemaname='public' order by tablename",
          )
        ).rows.map((r) => r.tablename);
        const result = {};
        for (const table of tables) {
          assert.match(table, /^[a-z_][a-z0-9_]*$/);
          result[table] = (
            await client.query(
              "select count(*)::int as count,md5(coalesce(string_agg(row_to_json(t)::text,chr(10) order by row_to_json(t)::text),'')) as hash from public.\"" +
                table +
                '" t',
            )
          ).rows[0];
        }
        return result;
      };
      const before = await inventory(db);
      const backup = await command(
        "docker",
        ["exec", container, "pg_dump", "-U", "postgres", "-Fc", "postgres"],
        { binary: true },
      );
      const restore = "chat_restore_" + randomBytes(6).toString("hex");
      await writeFile(path.join(runtime, restore + ".dump"), backup, {
        mode: 0o600,
      });
      await db.query('create database "' + restore + '"');
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
          restore,
        ],
        { input: backup },
      );
      const restored = await connect(s, restore);
      try {
        assert.deepEqual(await inventory(restored), before);
        const acl = await restored.query(
          "select has_table_privilege('anon','chat_workspaces','select') as allowed",
        );
        assert.equal(acl.rows[0].allowed, false);
        await restored.query("set role service_role");
        const result = await restored.query(
          "select count(*)::int as n from chat_brands",
        );
        assert.ok(result.rows[0].n > 0);
      } finally {
        await restored.end();
      }
      report.restore = {
        database: restore,
        tables: Object.keys(before).length,
        sha256: createHash("sha256").update(backup).digest("hex"),
        bytes: backup.length,
        manifest: before,
        limitation:
          "Database restore in same isolated PostgreSQL cluster; not full host/Clerk/Storage recovery.",
      };
    },
  );
} finally {
  await db.end();
  await writeFile(
    path.join(runtime, "qa-report.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  "Local QA passed: " +
    report.checks.length +
    " groups. Evidence: outputs/chat-local/qa-report.json",
);
