import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readChatRelease } from "../chat-release/build.mjs";

// Actual SQL replay for fresh, isolated databases only. Caller must prove ownership.
export async function applyChatMigrations(db, {ownedRelease=false,rolesPrepared=false}={}) {
  if(ownedRelease!==rolesPrepared)throw new Error("OWNED_RELEASE_ROLE_MODE_REQUIRED");
  // Validate every frozen source byte before creating fixture objects.
  const release=ownedRelease?readChatRelease(fileURLToPath(new URL("../../",import.meta.url))):null;
  if(!rolesPrepared) await db.query("create role anon;create role authenticated;create role service_role bypassrls;");
  await db.query(`grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);`);
  const folder = new URL("../../supabase/migrations/", import.meta.url);
  const files = readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if(ownedRelease && file.includes("_chat_")) continue;
    if (file === "20261014131000_shopify_handover_guards.sql") {
      // Existing optional handover module's dependency shape; no handover acceptance is claimed.
      await db.query(`create table order_handovers(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id),order_id uuid not null references orders(id),
     handover_number text not null,handover_type delivery_type not null,handed_over_at timestamptz not null,balance_acknowledged boolean not null,recipient_name text,status text not null default 'active',internal_notes text,deleted_at timestamptz);
     create table order_handover_items(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,order_id uuid not null,handover_id uuid not null references order_handovers(id),
     order_item_id uuid not null references order_items(id),quantity numeric not null default 1,pre_handover_item_status item_status,deleted_at timestamptz);
     alter table order_handovers enable row level security;alter table order_handover_items enable row level security;
     grant all on order_handovers,order_handover_items to service_role;`);
    }
    try {
      await db.query(readFileSync(new URL(file, folder), "utf8"));
    } catch (error) {
      throw new Error(
        "Migration " + file + ": " + error.code + " " + error.message,
      );
    }
  }
  if(release) await db.query(release.sql);
  console.log(
    "Applied " +
      files.length +
      " actual repository migrations to disposable PostgreSQL.",
  );
}
