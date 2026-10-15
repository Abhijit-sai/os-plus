-- Approval package PREPARATION ONLY. Not executed against the shared database.
-- Authorized administrator: run SELECT-only checks in a read-only session.
-- No customer names, contacts, order details, tokens or secrets are returned.
-- Aggregates cover ALL tenants because the proposed DDL is shared schema.
-- Review output privately; do not enable flags, repair rows or apply migrations.

-- 1. Catalog and history availability. If history is NULL, STOP and identify the
-- actual migration tracking mechanism. Do not infer history from REST errors.
select current_database() as database_name, current_user as database_role,
  current_setting('server_version') as server_version,
  to_regclass('supabase_migrations.schema_migrations') as migration_history;

-- 2. Run only if step 1 confirms that history relation exists.
-- Compare every version/name with the 51 historical filenames printed by
-- check-shopify-approval-package.mjs; investigate missing/extra/partial versions.
-- This package does not authorize replaying unrelated historical migrations.
select version, name from supabase_migrations.schema_migrations order by version;

-- 3. Exact baseline enum compatibility (shopify_manual is NOT shopify).
select t.typname, e.enumlabel, e.enumsortorder
from pg_type t join pg_namespace n on n.oid=t.typnamespace
join pg_enum e on e.enumtypid=t.oid
where n.nspname='public' and t.typname in ('order_source','order_status')
order by t.typname,e.enumsortorder;

-- 4. Existing order constraint compatibility. Nonzero counts require diagnosis,
-- NOT automatic data cleanup, source relabeling or financial reclassification.
select count(*) as orders_all_tenants,
  count(*) filter(where source::text='shopify') as existing_shopify_source,
  count(*) filter(where source::text='shopify_manual') as legacy_shopify_manual,
  count(*) filter(where order_status::text='draft') as existing_draft_status,
  count(*) filter(where customer_id is null or delivery_type is null) as missing_customer_or_delivery,
  count(*) filter(where not exists(select 1 from public.customers c
    where c.id=o.customer_id and c.tenant_id=o.tenant_id)) as invalid_customer_tenant_link
from public.orders o;

-- 5. Presence/conflict check, independent of API schema cache.
select name, to_regclass('public.' || name) as relation
from (values ('shopify_connections'),('shopify_source_orders'),
  ('shopify_source_revisions'),('shopify_variant_mappings'),('shopify_releases'),
  ('shopify_operational_state'),('operational_orders'),('local_operational_orders')) as required(name);

-- 6. Verify the named Test target only; no production tenant activation.
select id,name,store_name,status from public.tenants
where id='7be40f50-94a0-46c5-af57-7eea5e36ea8a'::uuid;

-- 7. List already-existing relation grants, constraints and trigger definitions
-- for compatibility review. These contain schema identifiers, not business data.
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('orders','order_items','order_payments')
order by table_name,grantee,privilege_type;
select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.orders'::regclass order by conname;
select tgname, pg_get_triggerdef(oid) as definition from pg_trigger
where tgrelid='public.orders'::regclass and not tgisinternal order by tgname;
