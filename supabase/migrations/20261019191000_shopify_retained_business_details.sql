-- Dormant retention foundation. No policy seeds, order backfills or activation.
-- Existing importer remains untouched; only the explicit retained importer
-- below can save normalized business details, under an owner-approved policy.
create table public.shopify_business_retention_policies (
  tenant_id uuid not null,connection_id uuid primary key,actor_id text not null,
  retain_business_records boolean not null check(retain_business_records),
  raw_retention_hours integer not null default 24 check(raw_retention_hours=24),
  approved_at timestamptz not null default now(),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
create table public.shopify_commercial_details (
  tenant_id uuid not null,source_order_id uuid not null,revision_id uuid primary key,
  schema_version integer not null default 1 check(schema_version=1),
  details jsonb not null check(jsonb_typeof(details)='object' and octet_length(details::text)<=4000000),
  raw_expires_at timestamptz not null check(isfinite(raw_expires_at)),created_at timestamptz not null default now(),
  foreign key(tenant_id,source_order_id,revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
do $$ declare v_table text;begin
  foreach v_table in array array['shopify_business_retention_policies','shopify_commercial_details'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    execute format('grant select on public.%I to service_role',v_table);
    execute format('create trigger shopify_business_immutable before update or delete on public.%I for each row execute function public.protect_shopify_draft_audit()',v_table);
  end loop;
end $$;

create function public.approve_shopify_business_retention(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_consent boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_shopify_owner(p_tenant_id,p_connection_id,p_actor_id);
  if p_consent is distinct from true then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  insert into public.shopify_business_retention_policies(tenant_id,connection_id,actor_id,retain_business_records)
    values(p_tenant_id,p_connection_id,p_actor_id,true) on conflict(connection_id) do nothing;
end $$;
revoke all on function public.approve_shopify_business_retention(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.approve_shopify_business_retention(uuid,uuid,text,boolean) to service_role;

-- A narrow transaction-local capability permits the importer to populate only
-- Reference order ID. It does not unlock payments, production or manager edits.
create table public.shopify_reference_capabilities (
  backend_pid integer not null,transaction_id bigint not null,tenant_id uuid not null,order_id uuid not null,reference text not null,
  primary key(backend_pid,transaction_id,tenant_id,order_id),
  foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict
);
alter table public.shopify_reference_capabilities enable row level security;
revoke all on public.shopify_reference_capabilities from public,anon,authenticated,service_role;
create function public.has_shopify_reference_capability(p_tenant uuid,p_order uuid,p_reference text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.shopify_reference_capabilities where backend_pid=pg_backend_pid() and transaction_id=txid_current()
    and tenant_id=p_tenant and order_id=p_order and reference=p_reference);
$$;
revoke all on function public.has_shopify_reference_capability(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.has_shopify_reference_capability(uuid,uuid,text) to service_role;

create or replace function public.guard_shopify_draft_order() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare is_owner boolean;
begin
  is_owner:=current_user=pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass));
  if tg_op='INSERT' and new.source='shopify' and (not is_owner or new.order_status<>'draft') then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if tg_op='DELETE' and old.source='shopify' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if tg_op='UPDATE' and (old.source='shopify' or new.source='shopify') then
    if is_owner and public.has_shopify_reference_capability(old.tenant_id,old.id,new.reference_order_id) then
      if (to_jsonb(new)-array['reference_order_id','updated_at','updated_by']) is distinct from
        (to_jsonb(old)-array['reference_order_id','updated_at','updated_by']) then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif is_owner and public.has_shopify_release_capability(old.tenant_id,old.id) then
      if (to_jsonb(new)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) is distinct from
        (to_jsonb(old)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) or old.order_status<>'draft' or new.order_status<>'confirmed' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif old.order_status='draft' then
      if (to_jsonb(new)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at']) is distinct from (to_jsonb(old)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at'])
        or (new.customer_id is distinct from old.customer_id and not is_owner)
        or (new.source_currency_code is distinct from old.source_currency_code and (not is_owner or old.source_currency_code<>'XXX' or new.source_currency_code='XXX')) then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif (to_jsonb(new)-array['order_status','notes','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['order_status','notes','updated_at','updated_by'])
      or new.order_status='draft' then raise exception 'SHOPIFY_ORDER_READ_ONLY';end if;
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;

-- Manual Reference edits participate in the SAME lock as imports, only for
-- explicitly opted-in tenants. Existing manual duplicates are not rewritten.
create function public.guard_shopify_reference_match() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_reference text;v_key text;v_old_key text;
begin
  if not exists(select 1 from public.shopify_business_retention_policies where tenant_id=new.tenant_id) then return new;end if;
  if tg_op='UPDATE' and (new.tenant_id,new.reference_order_id) is not distinct from (old.tenant_id,old.reference_order_id) then return new;end if;
  v_reference:=public.normalize_shopify_reference(new.reference_order_id);
  if tg_op='UPDATE' then v_old_key:='shopify-reference:'||old.tenant_id||':'||public.normalize_shopify_reference(old.reference_order_id);end if;
  for v_key in select distinct k from unnest(array[v_old_key,'shopify-reference:'||new.tenant_id||':'||v_reference]) k where k is not null order by k loop
    perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  end loop;
  if v_reference is not null and exists(select 1 from public.orders o where o.tenant_id=new.tenant_id and o.id<>new.id
    and public.normalize_shopify_reference(o.reference_order_id)=v_reference and (new.source='shopify' or o.source='shopify'))
    then raise exception 'SHOPIFY_REFERENCE_CONFLICT';end if;
  return new;
end $$;
revoke all on function public.guard_shopify_reference_match() from public,anon,authenticated,service_role;
create trigger orders_shopify_reference_match before insert or update of reference_order_id,tenant_id on public.orders
  for each row execute function public.guard_shopify_reference_match();

create function public.import_shopify_retained_draft(p_input jsonb,p_recovery_only boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_details jsonb;v_result jsonb;v_revision public.shopify_source_revisions%rowtype;v_existing jsonb;v_line jsonb;v_address jsonb;
  v_match jsonb;v_reference text;v_tenant uuid;v_order uuid;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or p_recovery_only is null then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if not exists(select 1 from public.shopify_business_retention_policies where tenant_id=(p_input->>'tenantId')::uuid
    and connection_id=(p_input->>'connectionId')::uuid and retain_business_records and raw_retention_hours=24)
    then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
  v_details:=p_input->'commercialDetails';
  if jsonb_typeof(v_details) is distinct from 'object' or octet_length(v_details::text)>4000000
    or p_input->>'completeness' is distinct from 'complete'
    or not(v_details ?& array['sourceNumber','createdAt','updatedAt','cancelledAt','fulfillmentStatus','note','customer','shippingAddress','billingAddress','currency','subtotal','shipping','tax','discount','payment','lines'])
    or (v_details-array['sourceNumber','createdAt','updatedAt','cancelledAt','fulfillmentStatus','note','customer','shippingAddress','billingAddress','currency','subtotal','shipping','tax','discount','payment','lines'])<>'{}'::jsonb
    or jsonb_typeof(v_details->'sourceNumber')<>'string' or length(v_details->>'sourceNumber')>256
    or (v_details->>'createdAt')::timestamptz is distinct from (p_input->>'sourceCreatedAt')::timestamptz
    or (v_details->>'updatedAt')::timestamptz is distinct from (p_input->>'sourceUpdatedAt')::timestamptz
    or v_details->>'currency' is distinct from p_input->>'sourceCurrency'
    or jsonb_typeof(v_details->'lines') is distinct from 'array'
    or jsonb_typeof(v_details->'customer') is distinct from 'object'
    or ((v_details->'customer')-array['name','email','phone'])<>'{}'::jsonb
    or jsonb_typeof(v_details->'payment') is distinct from 'object'
    or ((v_details->'payment')-array['availability','status','statusLabel','currency','presentmentCurrency','amounts','presentmentAmounts','observedAt','sourceUpdatedAt','productionHeld','validation','reasons'])<>'{}'::jsonb
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for v_address in select value from jsonb_array_elements(jsonb_build_array(v_details->'shippingAddress',v_details->'billingAddress')) loop
    if v_address<>'null'::jsonb and (jsonb_typeof(v_address)<>'object' or (v_address-array['firstName','lastName','phone','address1','address2','city','province','countryCodeV2','zip'])<>'{}'::jsonb)
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  end loop;
  if jsonb_array_length(v_details->'lines')<>jsonb_array_length(p_input->'lines')
    or exists(select 1 from jsonb_array_elements(v_details->'lines') x group by x->>'id' having count(*)>1)
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for v_line in select value from jsonb_array_elements(v_details->'lines') loop
    if jsonb_typeof(v_line)<>'object' or (v_line-array['id','title','variant','sku','quantity','currentQuantity','isGiftCard','requiresShipping','unitPrice','unitCurrency','currentLineSubtotal','properties'])<>'{}'::jsonb
      or not exists(select 1 from jsonb_array_elements(p_input->'lines') x where x->>'lineGid'=v_line->>'id'
        and x->'quantity'=v_line->'quantity' and x->'currentQuantity'=v_line->'currentQuantity') then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  end loop;
  v_tenant:=(p_input->>'tenantId')::uuid;
  if not p_recovery_only then
    -- Same ordering as the core importer: connection before reference/rows.
    perform 1 from public.shopify_connections where tenant_id=v_tenant and id=(p_input->>'connectionId')::uuid
      and shop_gid=p_input->>'shopGid' and app_ref=p_input->>'appRef' and canonical_domain=p_input->>'shopDomain'
      and environment=p_input->>'environment' for update;
    if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    v_reference:=public.normalize_shopify_reference(v_details->>'sourceNumber');
    if v_reference is null then raise exception 'SHOPIFY_REFERENCE_CONFLICT';end if;
    perform pg_advisory_xact_lock(hashtextextended('shopify-reference:'||v_tenant||':'||v_reference,0));
    v_match:=public.match_shopify_order_reference(v_tenant,p_input->>'shopGid',p_input->>'sourceOrderGid',v_details->>'sourceNumber');
    if v_match->>'status' in ('reference_match','conflict') then raise exception 'SHOPIFY_REFERENCE_CONFLICT';end if;
  end if;
  -- Existing importer validates exact store, live lease, current policy, source
  -- timestamps and customer resolution. The full intent includes these details;
  -- lost-response recovery cannot substitute different retained facts.
  v_result:=public.import_shopify_draft(p_input,p_recovery_only);
  if v_result is null then return null;end if;
  select * into v_revision from public.shopify_source_revisions where tenant_id=(p_input->>'tenantId')::uuid
    and id=(v_result->>'sourceRevisionId')::uuid and source_digest=p_input->>'sourceDigest' and completeness='complete';
  if not found then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
  select details into v_existing from public.shopify_commercial_details where tenant_id=v_revision.tenant_id and revision_id=v_revision.id;
  if found then
    if v_existing is distinct from v_details then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
  elsif p_recovery_only then
    -- Read-only recovery never repairs or mutates a partially written import.
    raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';
  else
    insert into public.shopify_commercial_details(tenant_id,source_order_id,revision_id,details,raw_expires_at)
      values(v_revision.tenant_id,v_revision.source_order_id,v_revision.id,v_details,v_revision.observed_at+interval '24 hours');
  end if;
  if not p_recovery_only then
    v_order:=(v_result->>'orderId')::uuid;
    insert into public.shopify_reference_capabilities(backend_pid,transaction_id,tenant_id,order_id,reference)
      values(pg_backend_pid(),txid_current(),v_tenant,v_order,v_details->>'sourceNumber');
    update public.orders set reference_order_id=v_details->>'sourceNumber',updated_by='shopify-import'
      where tenant_id=v_tenant and id=v_order and order_status='draft' and reference_order_id is distinct from v_details->>'sourceNumber';
    -- Once the team starts production, preserve its order identity/reference.
    -- Later Shopify names remain in normalized source facts and use the existing
    -- source-change review/hold boundary; do not roll back that observation by
    -- attempting a prohibited operational-order edit.
    delete from public.shopify_reference_capabilities where backend_pid=pg_backend_pid() and transaction_id=txid_current() and tenant_id=v_tenant and order_id=v_order;
  end if;
  return v_result;
end $$;
revoke all on function public.import_shopify_retained_draft(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.import_shopify_retained_draft(jsonb,boolean) to service_role;

create function public.read_shopify_retained_order(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('schemaVersion',d.schema_version,'tenantId',o.tenant_id,'orderId',o.id,'number',o.order_number,
    'sourceOrderGid',s.order_gid,'details',d.details)
  from public.orders o
  join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id and c.shop_gid=s.shop_gid
  join public.tenants t on t.id=o.tenant_id and t.status='active'
  join lateral(select r.id from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  where o.tenant_id=p_tenant_id and o.id=p_order_id and o.deleted_at is null and o.source='shopify' and o.order_status='draft'
    and c.environment='production' and c.canonical_domain=p_domain and c.app_ref=p_app_ref
    and exists(select 1 from public.tenant_users u where u.tenant_id=o.tenant_id and u.clerk_user_id=p_actor_id
      and u.status='active' and u.role in ('owner_admin','manager'));
$$;
revoke all on function public.read_shopify_retained_order(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_retained_order(uuid,text,text,text,uuid) to service_role;
