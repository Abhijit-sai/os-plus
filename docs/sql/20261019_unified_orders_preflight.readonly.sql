-- Read-only catalogue gate. NOT migration execution, activation or a backup.
-- Run only against the explicitly approved OS PLUS database before the seven
-- new migrations. Any failure means STOP; do not skip or partially apply files.
begin read only;
set local statement_timeout='10s';
do $$
declare f regprocedure;definition text;needle text;target text;orders_owner oid;
begin
  if current_setting('server_version_num')::integer<150000 then raise exception 'PostgreSQL 15+ required';end if;
  foreach target in array array['public.orders','public.customers','public.shopify_connections','public.shopify_source_orders',
    'public.shopify_source_revisions','public.shopify_application_audit','public.shopify_releases','public.shopify_operational_state',
    'public.shopify_pilot_policies','public.operational_orders'] loop
    if to_regclass(target) is null then raise exception 'Missing prerequisite: %',target;end if;
  end loop;
  foreach target in array array['public.shopify_business_retention_policies','public.shopify_commercial_details',
    'public.shopify_manager_draft_setups','public.shopify_unified_policies','public.shopify_import_previews'] loop
    if to_regclass(target) is not null then raise exception 'New object already exists; reconcile installed package before proceeding: %',target;end if;
  end loop;
  select relowner into orders_owner from pg_class where oid='public.orders'::regclass;
  foreach target in array array['public.import_shopify_draft_v1(jsonb,boolean)','public.import_shopify_draft(jsonb,boolean)'] loop
    f:=to_regprocedure(target);
    if f is null then raise exception 'Missing core function: %',target;end if;
    if (select proowner from pg_proc where oid=f::oid)<>orders_owner then raise exception 'Function/table owner mismatch: %',target;end if;
    definition:=pg_get_functiondef(f);
    needle:=case when target like '%_v1(%' then 'v_created<v_connection.import_created_at_cutoff' else 'v_created<c.import_created_at_cutoff' end;
    if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
      raise exception 'Unexpected core cutoff definition: %. Review drift before applying.',target;
    end if;
  end loop;
end $$;
select 'Catalogue gate passed; no changes made. Full schema-drift review and approval are still required.' as result;
commit;
