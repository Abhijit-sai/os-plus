-- Dormant owner mappings. No release/materialization or store activation.
-- Historical configuration tables have globally unique IDs but no composite
-- keys. Add the keys needed to enforce tenant ownership in every mapping FK.
alter table public.item_types add constraint shopify_item_types_tenant_id_id_unique unique(tenant_id,id);
alter table public.item_type_standard_sizes add constraint shopify_sizes_tenant_id_id_unique unique(tenant_id,id);
create table public.shopify_variant_mappings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, connection_id uuid not null,
  variant_gid text not null check(variant_gid ~ '^gid://shopify/ProductVariant/[1-9][0-9]{0,31}$'),
  sku text check(length(sku) between 1 and 512 and sku=btrim(sku)),
  classification text not null check(classification in ('production','nonproduction')),
  item_type_id uuid, workflow_id uuid, standard_size_id uuid,
  is_active boolean not null default true,
  revision bigint not null default 1 check(revision between 1 and 9007199254740991),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text not null, updated_by text not null,
  unique(tenant_id,id), check(variant_gid is not null or sku is not null),
  check((classification='production' and item_type_id is not null and workflow_id is not null) or
    (classification='nonproduction' and item_type_id is null and workflow_id is null and standard_size_id is null)),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,item_type_id) references public.item_types(tenant_id,id) on delete restrict,
  foreign key(tenant_id,workflow_id) references public.workflows(tenant_id,id) on delete restrict,
  foreign key(tenant_id,standard_size_id) references public.item_type_standard_sizes(tenant_id,id) on delete restrict
);
create unique index shopify_mapping_variant_unique on public.shopify_variant_mappings(connection_id,variant_gid) where variant_gid is not null;
create table public.shopify_mapping_audit (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, connection_id uuid not null,
  mapping_id uuid not null, actor_id text not null, request_key uuid not null,
  intent_digest text not null, reason text not null check(length(btrim(reason)) between 1 and 1000),
  before_state jsonb, after_state jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  unique(tenant_id,request_key),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,mapping_id) references public.shopify_variant_mappings(tenant_id,id) on delete restrict
);
do $$ declare v_table text; begin
  foreach v_table in array array['shopify_variant_mappings','shopify_mapping_audit'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    execute format('grant select on public.%I to service_role',v_table);
  end loop;
end $$;
create trigger shopify_mapping_audit_immutable before update or delete on public.shopify_mapping_audit
  for each row execute function public.protect_shopify_intake_audit();

-- Authenticated server actor, never a browser-supplied actor ID. Save-for-future
-- only; existing source revisions/production items are not rewritten.
create function public.save_shopify_mapping(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_conn public.shopify_connections%rowtype; v_prior public.shopify_mapping_audit%rowtype;
  v_mapping public.shopify_variant_mappings%rowtype; v_before jsonb; v_intent text; v_result jsonb;
  v_id uuid; v_type uuid; v_workflow uuid; v_size uuid; v_variant text; v_sku text; v_class text; v_expected bigint;
begin
  if p_request_key is null or p_actor_id is null or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>10000
    or length(coalesce(btrim(p_input->>'reason'),'')) not between 1 and 1000 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  v_id:=(p_input->>'mappingId')::uuid; v_expected:=(p_input->>'expectedRevision')::bigint;
  v_type:=(p_input->>'itemTypeId')::uuid; v_workflow:=(p_input->>'workflowId')::uuid; v_size:=(p_input->>'standardSizeId')::uuid;
  v_variant:=p_input->>'variantGid'; v_sku:=nullif(btrim(p_input->>'sku'),''); v_class:=p_input->>'classification';
  if v_expected is null or v_expected<0 or v_expected>=9007199254740991 or (v_id is null and v_expected<>0)
    or (v_id is not null and v_expected=0) or v_variant is null
    or (v_variant is not null and v_variant !~ '^gid://shopify/ProductVariant/[1-9][0-9]{0,31}$')
    or length(coalesce(v_sku,''))>512 or v_class is null or v_class not in ('production','nonproduction')
    or (v_class='production' and (v_type is null or v_workflow is null))
    or (v_class='nonproduction' and (v_type is not null or v_workflow is not null or v_size is not null)) then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  select * into v_conn from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found or v_conn.verified_at is null or v_conn.status not in ('verified','paused') then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id and role='owner_admin' and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_verticals tv join public.vertical_definitions vd on vd.id=tv.vertical_definition_id
    where tv.tenant_id=p_tenant_id and tv.is_enabled and vd.key='boutique' and vd.is_active for share of tv,vd;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  v_intent:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_input)::text,'UTF8')),'hex');
  select * into v_prior from public.shopify_mapping_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if v_prior.actor_id<>p_actor_id or v_prior.intent_digest<>v_intent then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return v_prior.result;
  end if;
  if v_id is not null then
    select * into v_mapping from public.shopify_variant_mappings where tenant_id=p_tenant_id and connection_id=p_connection_id and id=v_id for update;
    if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
    if v_mapping.revision<>v_expected then raise exception 'SHOPIFY_STALE_REVISION'; end if;
    if v_mapping.variant_gid is distinct from v_variant then raise exception 'SHOPIFY_MAPPING_IDENTITY_IMMUTABLE'; end if;
    v_before:=to_jsonb(v_mapping);
  end if;
  if v_class='production' then
    -- Existing configuration serialization order: workflow then sorted stages.
    perform 1 from public.workflows where tenant_id=p_tenant_id and id=v_workflow and is_active and deleted_at is null
      and (item_type_id is null or item_type_id=v_type) for share;
    if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID'; end if;
    perform 1 from public.item_types where tenant_id=p_tenant_id and id=v_type and is_active and deleted_at is null for share;
    if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID'; end if;
    perform s.id from public.stage_master s join public.workflow_stages ws on ws.tenant_id=s.tenant_id and ws.stage_master_id=s.id
      where ws.tenant_id=p_tenant_id and ws.workflow_id=v_workflow and ws.is_active and ws.deleted_at is null order by s.id for share of s;
    if not exists(select 1 from public.workflow_stages where tenant_id=p_tenant_id and workflow_id=v_workflow and is_active and deleted_at is null)
      or exists(select 1 from public.workflow_stages ws left join public.stage_master s on s.tenant_id=ws.tenant_id and s.id=ws.stage_master_id
        where ws.tenant_id=p_tenant_id and ws.workflow_id=v_workflow and ws.is_active and ws.deleted_at is null and (s.id is null or not s.is_active or s.deleted_at is not null))
      then raise exception 'SHOPIFY_CONFIGURATION_INVALID'; end if;
    if v_size is not null then
      perform 1 from public.item_type_standard_sizes where tenant_id=p_tenant_id and id=v_size and item_type_id=v_type and is_active and deleted_at is null for share;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID'; end if;
    end if;
    perform cs.id from public.customer_statuses cs where cs.tenant_id=p_tenant_id and cs.id in (
      select coalesce(ws.customer_status_id,s.default_customer_status_id) from public.workflow_stages ws
      join public.stage_master s on s.tenant_id=ws.tenant_id and s.id=ws.stage_master_id
      where ws.tenant_id=p_tenant_id and ws.workflow_id=v_workflow and ws.is_active and ws.deleted_at is null
    ) order by cs.id for share;
    if exists(select 1 from public.workflow_stages ws join public.stage_master s on s.tenant_id=ws.tenant_id and s.id=ws.stage_master_id
      left join public.customer_statuses cs on cs.tenant_id=ws.tenant_id and cs.id=coalesce(ws.customer_status_id,s.default_customer_status_id)
      where ws.tenant_id=p_tenant_id and ws.workflow_id=v_workflow and ws.is_active and ws.deleted_at is null
        and coalesce(ws.customer_status_id,s.default_customer_status_id) is not null and (cs.id is null or not cs.is_active or cs.deleted_at is not null))
      then raise exception 'SHOPIFY_CONFIGURATION_INVALID'; end if;
  end if;
  if v_id is null then
    insert into public.shopify_variant_mappings(tenant_id,connection_id,variant_gid,sku,classification,item_type_id,workflow_id,standard_size_id,is_active,created_by,updated_by)
      values(p_tenant_id,p_connection_id,v_variant,v_sku,v_class,v_type,v_workflow,v_size,coalesce((p_input->>'isActive')::boolean,true),p_actor_id,p_actor_id) returning * into v_mapping;
  else
    update public.shopify_variant_mappings set sku=v_sku,classification=v_class,item_type_id=v_type,workflow_id=v_workflow,standard_size_id=v_size,
      is_active=coalesce((p_input->>'isActive')::boolean,true),revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor_id where tenant_id=p_tenant_id and id=v_id returning * into v_mapping;
  end if;
  v_result:=jsonb_build_object('mappingId',v_mapping.id,'revision',v_mapping.revision);
  insert into public.shopify_mapping_audit(tenant_id,connection_id,mapping_id,actor_id,request_key,intent_digest,reason,before_state,after_state,result)
    values(p_tenant_id,p_connection_id,v_mapping.id,p_actor_id,p_request_key,v_intent,p_input->>'reason',v_before,to_jsonb(v_mapping),v_result);
  return v_result;
end $$;
revoke all on function public.save_shopify_mapping(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_shopify_mapping(uuid,uuid,text,uuid,jsonb) to service_role;
