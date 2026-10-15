-- Shopify compatibility with an independently owned optional handover module.
-- Do not replace its commands, tenant checks, tables, history or financial logic.
create function public.guard_shopify_handover() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a jsonb;b jsonb;x jsonb;v_order uuid;v_tenant uuid;s public.shopify_source_orders%rowtype;
  v_parent_tenant uuid;v_parent_order uuid;v_status text;v_held boolean;
begin
  if tg_op<>'DELETE' then a:=to_jsonb(new);end if;
  if tg_op<>'INSERT' then b:=to_jsonb(old);end if;
  -- Check both old and new parent pairs so repointing cannot escape a hold.
  for x in select value from (select distinct value from (values(a),(b)) as rows(value)
    where value is not null) parents order by value->>'order_id',value->>'tenant_id'
  loop
    v_order:=(x->>'order_id')::uuid;v_tenant:=(x->>'tenant_id')::uuid;
    -- Leave purely local records to the existing handover module, including
    -- its concurrency/validation behavior. No new parent locks for local work.
    select * into s from public.shopify_source_orders where tenant_id=v_tenant and order_id=v_order for share nowait;
    if not found then
      if exists(select 1 from public.shopify_source_orders where order_id=v_order and tenant_id<>v_tenant)
        then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
      -- A caller cannot disguise Shopify work by putting a local order pair
      -- beside a Shopify header/item ID. These classification reads take no row
      -- locks, so valid local handovers retain their original concurrency.
      if tg_table_name='order_handover_items' and (
        exists(select 1 from public.order_handovers h join public.shopify_source_orders p
          on p.tenant_id=h.tenant_id and p.order_id=h.order_id where h.id=(x->>'handover_id')::uuid)
        or exists(select 1 from public.order_items i join public.shopify_source_orders p
          on p.tenant_id=i.tenant_id and p.order_id=i.order_id where i.id=(x->>'order_item_id')::uuid))
        then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
      continue;
    end if;
    select o.order_status::text into v_status from public.orders o where o.id=v_order and o.tenant_id=v_tenant;
    if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    if tg_table_name='order_handover_items' then
      select h.tenant_id,h.order_id into v_parent_tenant,v_parent_order
        from public.order_handovers h where h.id=(x->>'handover_id')::uuid for share nowait;
      if not found or v_parent_tenant is distinct from v_tenant or v_parent_order is distinct from v_order
        then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
      if not exists(select 1 from public.order_items i where i.id=(x->>'order_item_id')::uuid
        and i.tenant_id=v_tenant and i.order_id=v_order) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    end if;
    -- Same immutable source anchor/lock discipline as ingestion and production.
    -- NOWAIT fails safely rather than deadlocking order-first dispatch commands
    -- against source-first imports. An operation holding SHARE can finish before
    -- a later source hold commits; no subsequent dispatch may bypass that hold.
    if v_status='draft' or not exists(select 1 from public.shopify_releases r where r.tenant_id=v_tenant and r.source_order_id=s.id)
      then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    if tg_op='DELETE' or (tg_op='UPDATE' and a->'deleted_at' is distinct from b->'deleted_at')
      then raise exception 'SHOPIFY_HISTORY_PROTECTED';end if;
    if tg_op='UPDATE' and jsonb_build_array(a->'id',a->'tenant_id',a->'order_id',a->'handover_id',a->'order_item_id')
      is distinct from jsonb_build_array(b->'id',b->'tenant_id',b->'order_id',b->'handover_id',b->'order_item_id')
      then raise exception 'SHOPIFY_HISTORY_PROTECTED';end if;
    -- Lock the state row too: an older REPEATABLE READ snapshot must serialize
    -- or fail, never use a stale pre-hold value after the source lock is free.
    select st.held into v_held from public.shopify_operational_state st
      where st.tenant_id=v_tenant and st.source_order_id=s.id for share nowait;
    if not found or v_held then raise exception 'SHOPIFY_PRODUCTION_HELD';end if;
  end loop;
  if tg_op='DELETE' then return old;end if;return new;
exception when lock_not_available then raise exception 'SHOPIFY_SOURCE_BUSY';
end $$;
revoke all on function public.guard_shopify_handover() from public,anon,authenticated,service_role;
do $$ declare t text;begin
  foreach t in array array['order_handovers','order_handover_items'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create trigger aaa_shopify_handover_guard before insert or update or delete on public.%I for each row execute function public.guard_shopify_handover()',t);
    end if;
  end loop;
end $$;
comment on function public.guard_shopify_handover() is
  'Shopify dispatch fence: released and unheld only; parent/item scope checked, history retained, source changes serialized. Attach to handover relations if that module is installed later.';
