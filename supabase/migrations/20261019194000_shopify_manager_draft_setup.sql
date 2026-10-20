-- DRAFT: saves per-order team choices, not variant mappings or production rows.
-- Completing setup is a separate atomic command. This migration enables no
-- imports and seeds no policy; shared application still requires approval.
create table public.shopify_manager_draft_setups (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_order_id uuid not null,source_revision_id uuid not null,
  version bigint not null check(version between 1 and 9007199254740991),
  actor_id text not null,request_key uuid not null,intent_digest text not null,
  choices jsonb not null check(jsonb_typeof(choices)='object'),created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,id),unique(tenant_id,request_key),unique(source_order_id,version),
  foreign key(tenant_id,source_order_id,source_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
alter table public.shopify_manager_draft_setups enable row level security;
revoke all on public.shopify_manager_draft_setups from public,anon,authenticated,service_role;
grant select on public.shopify_manager_draft_setups to service_role;
create trigger shopify_manager_setup_immutable before update or delete on public.shopify_manager_draft_setups
  for each row execute function public.protect_shopify_draft_audit();

create function public.assert_shopify_setup_actor(p_tenant uuid,p_connection uuid,p_domain text,p_app_ref text,p_actor text)
returns public.shopify_connections language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;begin
  select * into c from public.shopify_connections where tenant_id=p_tenant and id=p_connection
    and canonical_domain=p_domain and app_ref=p_app_ref and environment='production' for update;
  if not found or c.verified_at is null or c.status not in ('verified','paused')
    or not exists(select 1 from public.shopify_business_retention_policies where tenant_id=p_tenant and connection_id=p_connection)
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform 1 from public.tenants where id=p_tenant and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant and clerk_user_id=p_actor and role in ('owner_admin','manager') and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform 1 from public.tenant_verticals tv join public.vertical_definitions vd on vd.id=tv.vertical_definition_id
    where tv.tenant_id=p_tenant and tv.is_enabled and vd.key='boutique' and vd.is_active for share of tv,vd;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  if exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant and connection_id=p_connection and topic in ('customers/redact','shop/redact'))
    then raise exception 'SHOPIFY_PRIVACY_REVIEW';end if;
  return c;
end $$;
revoke all on function public.assert_shopify_setup_actor(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;

create function public.save_shopify_manager_draft_setup(p_tenant_id uuid,p_connection_id uuid,p_domain text,p_app_ref text,p_actor_id text,
  p_order_id uuid,p_source_revision_id uuid,p_expected_version bigint,p_request_key uuid,p_choices jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.shopify_source_orders%rowtype;o public.orders%rowtype;prior public.shopify_manager_draft_setups%rowtype;
  v_version bigint;v_hash text;v_line jsonb;v_date text;v_type uuid;v_workflow uuid;v_size uuid;
begin
  if p_order_id is null or p_source_revision_id is null or p_request_key is null
    or p_expected_version is null or p_expected_version not between 0 and 9007199254740990
    or jsonb_typeof(p_choices) is distinct from 'object' or octet_length(p_choices::text)>1000000
    or not p_choices ?& array['customerId','deliveryType','promisedDeliveryDate','note','lines']
    or p_choices-array['customerId','deliveryType','promisedDeliveryDate','note','lines']<>'{}'::jsonb
    or jsonb_typeof(p_choices->'note') is distinct from 'string' or length(p_choices->>'note')>1000
    or (p_choices->'deliveryType'<>'null'::jsonb and coalesce(p_choices->>'deliveryType','') not in ('store_pickup','self_delivery','courier'))
    or jsonb_typeof(p_choices->'lines') is distinct from 'array' or jsonb_array_length(p_choices->'lines') not between 1 and 500
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-manager-setup:'||p_tenant_id::text||':'||p_request_key::text,0));
  perform public.assert_shopify_setup_actor(p_tenant_id,p_connection_id,p_domain,p_app_ref,p_actor_id);
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_order_id,p_source_revision_id,p_expected_version,p_choices)::text,'UTF8')),'hex');
  select * into prior from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if prior.actor_id<>p_actor_id or prior.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return jsonb_build_object('setupId',prior.id,'version',prior.version);
  end if;
  select * into s from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and order_id=p_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into o from public.orders where tenant_id=p_tenant_id and id=p_order_id for update;
  if not found or o.deleted_at is not null or o.order_status<>'draft' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if p_source_revision_id is distinct from (select id from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id order by generation desc limit 1)
    or not exists(select 1 from public.shopify_source_revisions r join public.shopify_commercial_details d on d.tenant_id=r.tenant_id and d.revision_id=r.id
      where r.tenant_id=p_tenant_id and r.source_order_id=s.id and r.id=p_source_revision_id and r.completeness='complete')
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select coalesce(max(version),0) into v_version from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and source_order_id=s.id;
  if v_version<>p_expected_version then raise exception 'SHOPIFY_STALE_REVISION';end if;
  if p_choices->>'customerId' is not null then
    perform 1 from public.customers where tenant_id=p_tenant_id and id=(p_choices->>'customerId')::uuid and deleted_at is null for share;
    if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID';end if;
  end if;
  v_date:=p_choices->>'promisedDeliveryDate';
  if v_date is not null and (v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_date::date,'YYYY-MM-DD')<>v_date) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if jsonb_array_length(p_choices->'lines')<>(select count(*) from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id)
    or exists(select 1 from jsonb_array_elements(p_choices->'lines') x group by x->>'lineGid' having count(*)<>1)
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for v_line in select value from jsonb_array_elements(p_choices->'lines') loop
    if jsonb_typeof(v_line)<>'object' or not v_line ?& array['lineGid','itemTypeId','workflowId','standardSizeId','expectedCompletionDate']
      or v_line-array['lineGid','itemTypeId','workflowId','standardSizeId','expectedCompletionDate']<>'{}'::jsonb
      or not exists(select 1 from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id and line_gid=v_line->>'lineGid')
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    v_type:=(v_line->>'itemTypeId')::uuid;v_workflow:=(v_line->>'workflowId')::uuid;v_size:=(v_line->>'standardSizeId')::uuid;
    if v_type is not null then
      perform 1 from public.item_types where tenant_id=p_tenant_id and id=v_type and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    if v_workflow is not null then
      perform 1 from public.workflows where tenant_id=p_tenant_id and id=v_workflow and is_active and deleted_at is null
        and (v_type is null or item_type_id is null or item_type_id=v_type) for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    if v_size is not null then
      perform 1 from public.item_type_standard_sizes where tenant_id=p_tenant_id and id=v_size and item_type_id=v_type and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    v_date:=v_line->>'expectedCompletionDate';
    if v_date is not null and (v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_date::date,'YYYY-MM-DD')<>v_date) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  end loop;
  insert into public.shopify_manager_draft_setups(tenant_id,source_order_id,source_revision_id,version,actor_id,request_key,intent_digest,choices)
    values(p_tenant_id,s.id,p_source_revision_id,v_version+1,p_actor_id,p_request_key,v_hash,p_choices) returning * into prior;
  return jsonb_build_object('setupId',prior.id,'version',prior.version);
exception when lock_not_available then raise exception 'SHOPIFY_CONFIGURATION_BUSY';
end $$;
revoke all on function public.save_shopify_manager_draft_setup(uuid,uuid,text,text,text,uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_shopify_manager_draft_setup(uuid,uuid,text,text,text,uuid,uuid,bigint,uuid,jsonb) to service_role;

create function public.read_shopify_manager_draft_setup(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('tenantId',o.tenant_id,'orderId',o.id,'connectionId',c.id,'shopGid',s.shop_gid,'sourceOrderId',s.id,
    'sourceOrderGid',s.order_gid,'sourceRevisionId',r.id,'sourceDigest',r.source_digest,'sourceUpdatedAt',r.source_updated_at,
    'setupId',setup.id,'version',coalesce(setup.version,0),'current',coalesce(setup.source_revision_id=r.id,true),
    'choices',setup.choices,'customerId',o.customer_id,
    'itemTypes',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name) order by x.name),'[]') from
      (select id,name from public.item_types where tenant_id=p_tenant_id and is_active and deleted_at is null order by name,id limit 500) x),
    'workflows',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'itemTypeId',x.item_type_id) order by x.name),'[]') from
      (select id,name,item_type_id from public.workflows where tenant_id=p_tenant_id and is_active and deleted_at is null order by name,id limit 500) x),
    'sizes',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.size_label,'itemTypeId',x.item_type_id) order by x.size_label),'[]') from
      (select id,size_label,item_type_id from public.item_type_standard_sizes where tenant_id=p_tenant_id and is_active and deleted_at is null order by size_label,id limit 500) x),
    'customers',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name)),'[]') from
      (select id,name from public.customers where tenant_id=p_tenant_id and deleted_at is null
        order by (id=coalesce((setup.choices->>'customerId')::uuid,o.customer_id)) desc nulls last,name,id limit 100) x),
    'customerSearchRequired',(select count(*)>100 from public.customers where tenant_id=p_tenant_id and deleted_at is null))
  from public.orders o
  join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id and c.shop_gid=s.shop_gid
  join public.shopify_business_retention_policies p on p.tenant_id=c.tenant_id and p.connection_id=c.id
  join lateral(select r.* from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  left join lateral(select a.* from public.shopify_manager_draft_setups a where a.tenant_id=s.tenant_id and a.source_order_id=s.id order by a.version desc limit 1) setup on true
  where o.tenant_id=p_tenant_id and o.id=p_order_id and o.deleted_at is null and o.order_status='draft' and r.completeness='complete'
    and c.environment='production' and c.canonical_domain=p_domain and c.app_ref=p_app_ref and c.status in ('verified','paused') and c.verified_at is not null
    and exists(select 1 from public.tenants where id=p_tenant_id and status='active')
    and exists(select 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id and status='active' and role in ('owner_admin','manager'));
$$;
revoke all on function public.read_shopify_manager_draft_setup(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_manager_draft_setup(uuid,text,text,text,uuid) to service_role;

-- Search beyond the initial dropdowns without exporting the tenant's customer
-- directory. Literal substring matching, explicit pages and current actor gate.
create function public.search_shopify_setup_options(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid,
  p_kind text,p_search text,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_kind not in ('customers','itemTypes','workflows','sizes') or p_search is null or length(p_search)>100
    or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if public.read_shopify_manager_draft_setup(p_tenant_id,p_actor_id,p_domain,p_app_ref,p_order_id) is null
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'itemTypeId',item_type_id) order by name,id),'[]') into result
  from (
    select * from (
      select id,name,null::uuid item_type_id from public.customers where p_kind='customers' and tenant_id=p_tenant_id and deleted_at is null
      union all select id,name,null::uuid from public.item_types where p_kind='itemTypes' and tenant_id=p_tenant_id and is_active and deleted_at is null
      union all select id,name,item_type_id from public.workflows where p_kind='workflows' and tenant_id=p_tenant_id and is_active and deleted_at is null
      union all select id,size_label,item_type_id from public.item_type_standard_sizes where p_kind='sizes' and tenant_id=p_tenant_id and is_active and deleted_at is null
    ) options where strpos(lower(name),lower(btrim(p_search)))>0 order by name,id limit 51 offset p_offset
  ) page;
  return jsonb_build_object('rows',case when jsonb_array_length(result)>50 then result-50 else result end,'hasMore',jsonb_array_length(result)>50);
end $$;
revoke all on function public.search_shopify_setup_options(uuid,text,text,text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.search_shopify_setup_options(uuid,text,text,text,uuid,text,text,integer) to service_role;
