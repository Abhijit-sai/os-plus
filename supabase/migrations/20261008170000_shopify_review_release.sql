-- Unapplied/dormant owner review and atomic Boutique release. Enablement defaults
-- off. No setup, credentials, subscription, seed or shared-data backfill.
alter table public.shopify_connections add column release_enabled boolean not null default false;
alter table public.shopify_source_revisions add constraint shopify_revision_source_key unique(tenant_id,source_order_id,id);
alter table public.order_items add constraint shopify_item_order_key unique(tenant_id,order_id,id);

create table public.shopify_draft_reviews (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_order_id uuid not null,source_revision_id uuid not null,
  version bigint not null check(version between 1 and 9007199254740991),actor_id text not null,request_key uuid not null,
  intent_digest text not null,decision jsonb not null,created_at timestamptz not null default now(),
  unique(tenant_id,id),unique(tenant_id,request_key),unique(source_order_id,version),
  foreign key(tenant_id,source_order_id,source_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
create table public.shopify_releases (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_order_id uuid not null,source_revision_id uuid not null,
  review_id uuid not null,actor_id text not null,request_key uuid not null,intent_digest text not null,result jsonb not null,created_at timestamptz not null default now(),
  unique(tenant_id,id),unique(source_order_id),unique(tenant_id,request_key),
  foreign key(tenant_id,source_order_id,source_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,review_id) references public.shopify_draft_reviews(tenant_id,id) on delete restrict
);
create table public.shopify_order_item_links (
  tenant_id uuid not null,source_order_id uuid not null,order_id uuid not null,line_gid text not null,order_item_id uuid not null,
  source_revision_id uuid not null,mapping_id uuid not null,mapping_revision bigint not null,created_at timestamptz not null default now(),
  primary key(source_order_id,line_gid),unique(order_item_id),
  foreign key(tenant_id,source_order_id) references public.shopify_source_orders(tenant_id,id) on delete restrict,
  foreign key(tenant_id,source_order_id,source_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,order_id,order_item_id) references public.order_items(tenant_id,order_id,id) on delete restrict,
  foreign key(tenant_id,mapping_id) references public.shopify_variant_mappings(tenant_id,id) on delete restrict
);
-- Transaction-local capability, not a session/GUC bypass. No service/client
-- privilege. Only owner-definer validated release may insert production rows.
create table public.shopify_release_capabilities (
  backend_pid integer not null,transaction_id bigint not null,tenant_id uuid not null,order_id uuid not null,
  primary key(backend_pid,transaction_id,tenant_id,order_id),
  foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict
);
do $$ declare t text; begin
  foreach t in array array['shopify_draft_reviews','shopify_releases','shopify_order_item_links','shopify_release_capabilities'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    if t<>'shopify_release_capabilities' then
      execute format('grant select on public.%I to service_role',t);
      execute format('create trigger shopify_review_immutable before update or delete on public.%I for each row execute function public.protect_shopify_draft_audit()',t);
    end if;
  end loop;
end $$;
create function public.assert_shopify_owner(p_tenant uuid,p_connection uuid,p_actor text) returns public.shopify_connections
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;
begin
  select * into c from public.shopify_connections where tenant_id=p_tenant and id=p_connection for update;
  if not found or c.verified_at is null or c.status not in ('verified','paused') then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenants where id=p_tenant and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant and clerk_user_id=p_actor and role='owner_admin' and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_verticals tv join public.vertical_definitions vd on vd.id=tv.vertical_definition_id
    where tv.tenant_id=p_tenant and tv.is_enabled and vd.key='boutique' and vd.is_active for share of tv,vd;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  if exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant and connection_id=p_connection and topic in ('customers/redact','shop/redact')) then raise exception 'SHOPIFY_PRIVACY_REVIEW'; end if;
  return c;
end $$;
revoke all on function public.assert_shopify_owner(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Receipt reads recheck current owner membership/tenant scope, not mutable
-- installation, privacy or configuration enablement. They authorize no write.
create function public.assert_shopify_receipt_reader(p_tenant uuid,p_connection uuid,p_actor text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
  if not exists(select 1 from public.shopify_connections where tenant_id=p_tenant and id=p_connection)
    or not exists(select 1 from public.tenants where id=p_tenant and status='active')
    or not exists(select 1 from public.tenant_users where tenant_id=p_tenant and clerk_user_id=p_actor and role='owner_admin' and status='active')
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
end $$;
revoke all on function public.assert_shopify_receipt_reader(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.save_shopify_draft_review(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,
  p_source_order_id uuid,p_source_revision_id uuid,p_expected_version bigint,p_decision jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;s public.shopify_source_orders%rowtype;r public.shopify_draft_reviews%rowtype;
  v_hash text;v_version bigint;v_order public.orders%rowtype;v_line jsonb;
begin
  if p_request_key is null or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740991
    or p_decision is null or jsonb_typeof(p_decision)<>'object' or octet_length(p_decision::text)>1000000
    or length(coalesce(btrim(p_decision->>'reason'),'')) not between 1 and 1000 or p_decision->>'deliveryType' not in ('store_pickup','self_delivery','courier')
    or p_decision->>'deliveryType' is null or p_decision->>'customerId' is null
    or jsonb_typeof(p_decision->'lines') is distinct from 'array' or jsonb_array_length(p_decision->'lines') not between 1 and 500
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  -- Serialize identical command retries BEFORE receipt lookup. A request that
  -- waited behind a successful peer must recover its committed receipt rather
  -- than revalidate the now-advanced review version or draft state.
  perform pg_advisory_xact_lock(hashtextextended('shopify-review:'||p_tenant_id::text||':'||p_request_key::text,0));
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_source_order_id,p_source_revision_id,p_expected_version,p_decision)::text,'UTF8')),'hex');
  select * into r from public.shopify_draft_reviews where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
    if r.actor_id<>p_actor_id or r.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('reviewId',r.id,'version',r.version);
  end if;
  c:=public.assert_shopify_owner(p_tenant_id,p_connection_id,p_actor_id);
  select * into s from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and id=p_source_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  select * into v_order from public.orders where tenant_id=p_tenant_id and id=s.order_id for update;
  if not found or v_order.deleted_at is not null or v_order.order_status<>'draft' then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
  if p_source_revision_id is distinct from (select id from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id order by generation desc limit 1)
    or not exists(select 1 from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id and id=p_source_revision_id and completeness='complete' and sealed_source ? 'ciphertext')
    then raise exception 'SHOPIFY_STALE_REVISION'; end if;
  select coalesce(max(version),0) into v_version from public.shopify_draft_reviews where tenant_id=p_tenant_id and source_order_id=s.id;
  if v_version<>p_expected_version then raise exception 'SHOPIFY_STALE_REVISION'; end if;
  perform 1 from public.customers where tenant_id=p_tenant_id and id=(p_decision->>'customerId')::uuid and deleted_at is null for share;
  if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID'; end if;
  if (select count(*) from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id)<>jsonb_array_length(p_decision->'lines')
    or exists(select 1 from jsonb_array_elements(p_decision->'lines') x group by x->>'lineGid' having count(*)<>1)
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  for v_line in select value from jsonb_array_elements(p_decision->'lines') loop
    if jsonb_typeof(v_line)<>'object' or not exists(select 1 from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id and line_gid=v_line->>'lineGid')
      or v_line->>'mappingId' is null or v_line->>'mappingRevision' is null or length(coalesce(v_line->>'nameOverride',''))>2000 or length(coalesce(v_line->>'colourOverride',''))>2000
      or not exists(select 1 from public.shopify_variant_mappings where tenant_id=p_tenant_id and connection_id=p_connection_id and id=(v_line->>'mappingId')::uuid and revision=(v_line->>'mappingRevision')::bigint and is_active)
      then raise exception 'SHOPIFY_MAPPING_INVALID'; end if;
  end loop;
  insert into public.shopify_draft_reviews(tenant_id,source_order_id,source_revision_id,version,actor_id,request_key,intent_digest,decision)
    values(p_tenant_id,s.id,p_source_revision_id,v_version+1,p_actor_id,p_request_key,v_hash,p_decision) returning * into r;
  return jsonb_build_object('reviewId',r.id,'version',r.version);
end $$;
revoke all on function public.save_shopify_draft_review(uuid,uuid,text,uuid,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_shopify_draft_review(uuid,uuid,text,uuid,uuid,uuid,bigint,jsonb) to service_role;

-- Ordinary service caller can execute guard evaluation but cannot insert/read
-- capabilities. Definer wrapper reads only its boolean; current caller identity
-- is checked inside trigger rather than replaced by the helper's definer.
create function public.has_shopify_release_capability(p_tenant uuid,p_order uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.shopify_release_capabilities where backend_pid=pg_backend_pid() and transaction_id=txid_current() and tenant_id=p_tenant and order_id=p_order);
$$;
revoke all on function public.has_shopify_release_capability(uuid,uuid) from public,anon,authenticated;
grant execute on function public.has_shopify_release_capability(uuid,uuid) to service_role;

alter table public.orders drop constraint orders_shopify_dormant_boundary;
alter table public.orders add constraint orders_shopify_financial_boundary check(
  (source<>'shopify' and financial_management='local' and order_status<>'draft') or
  (source='shopify' and financial_management='external_shopify' and amount_paid=0 and payment_status='unpaid'
    and gst_amount=0 and taxable_amount=0 and gst_rate=0 and gst_treatment='not_applicable'
    and (order_status<>'draft' or (subtotal=0 and discount_amount=0 and total_amount=0)))
);
create or replace function public.guard_shopify_draft_order() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare is_owner boolean;
begin
  is_owner:=current_user=pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass));
  if tg_op='INSERT' and new.source='shopify' and (not is_owner or new.order_status<>'draft') then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
  if tg_op='DELETE' and old.source='shopify' then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
  if tg_op='UPDATE' and (old.source='shopify' or new.source='shopify') then
    if is_owner and public.has_shopify_release_capability(old.tenant_id,old.id) then
      if (to_jsonb(new)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) is distinct from
        (to_jsonb(old)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) or old.order_status<>'draft' or new.order_status<>'confirmed' then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
    elsif old.order_status='draft' then
      if (to_jsonb(new)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at']) is distinct from (to_jsonb(old)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at'])
        or (new.customer_id is distinct from old.customer_id and not is_owner)
        or (new.source_currency_code is distinct from old.source_currency_code and (not is_owner or old.source_currency_code<>'XXX' or new.source_currency_code='XXX')) then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
    elsif (to_jsonb(new)-array['order_status','notes','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['order_status','notes','updated_at','updated_by'])
      or new.order_status='draft' then raise exception 'SHOPIFY_ORDER_READ_ONLY'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;return new;
end $$;
create or replace function public.guard_shopify_order_child() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare v_new jsonb;v_old jsonb;v_order uuid;v_tenant uuid;v_key text;v_status public.order_status;is_owner boolean;
begin
  v_key:=case when tg_table_name='receivables_payables' then 'linked_order_id' else 'order_id' end;
  is_owner:=current_user=pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass));
  if tg_op<>'DELETE' then v_new:=to_jsonb(new);end if;if tg_op<>'INSERT' then v_old:=to_jsonb(old);end if;
  for v_order,v_tenant in select distinct (x->>v_key)::uuid,(x->>'tenant_id')::uuid from (values(v_new),(v_old)) as records(x) where x->>v_key is not null order by 1,2 loop
    select order_status into v_status from public.orders where id=v_order and tenant_id=v_tenant and source='shopify' for update;
    if found then
      if tg_table_name='order_items' and tg_op='INSERT' and is_owner and public.has_shopify_release_capability(v_tenant,v_order) then null;
      elsif tg_table_name='order_items' and tg_op='UPDATE' and v_status<>'draft'
        and (v_new-array['item_status','customer_status_id','notes','updated_at','updated_by']) is not distinct from (v_old-array['item_status','customer_status_id','notes','updated_at','updated_by']) then null;
      else raise exception 'SHOPIFY_ORDER_READ_ONLY';end if;
    end if;
    if exists(select 1 from public.orders where id=v_order and tenant_id<>v_tenant) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  end loop;
  if tg_op='DELETE' then return old;end if;return new;
end $$;

-- Prepared source values below are reconstructed by the server from authenticated
-- ciphertext; they are NOT browser/n8n money, names, quantities or timestamps.
create function public.release_shopify_order(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,
  p_source_order_id uuid,p_review_id uuid,p_input jsonb,p_recovery_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;s public.shopify_source_orders%rowtype;r public.shopify_draft_reviews%rowtype;
  prior public.shopify_releases%rowtype;v_source public.shopify_source_revisions%rowtype;v_order public.orders%rowtype;
  v_map public.shopify_variant_mappings%rowtype;v_line jsonb;v_choice jsonb;v_hash text;v_result jsonb;
  v_item uuid;v_instance uuid;v_first uuid;v_stage uuid;v_config record;v_count integer:=0;v_subtotal numeric:=0;v_discount numeric:=0;v_gross numeric;v_net numeric;
begin
  if p_request_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4000000
    or jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines') not between 1 and 500
    or coalesce(p_input->>'sourceDigest','') !~ '^[0-9a-f]{64}$' or p_input->>'verifiedAt' is null or p_input->>'sourceUpdatedAt' is null
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-release:'||p_tenant_id::text||':'||p_request_key::text,0));
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_source_order_id,p_review_id,p_input-'verifiedAt')::text,'UTF8')),'hex');
  select * into prior from public.shopify_releases where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
    if prior.actor_id<>p_actor_id or prior.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return prior.result;
  end if;
  if p_recovery_only then
    perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
    return null;
  end if;
  c:=public.assert_shopify_owner(p_tenant_id,p_connection_id,p_actor_id);
  if not c.release_enabled or c.status<>'verified' or not c.processing_enabled or not c.draft_import_enabled then raise exception 'SHOPIFY_RELEASE_DISABLED';end if;
  if coalesce(p_input->>'connectionRevision','') !~ '^[1-9][0-9]{0,15}$'
    or (p_input->>'connectionRevision')::bigint<>c.revision then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select * into s from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and id=p_source_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into v_order from public.orders where tenant_id=p_tenant_id and id=s.order_id for update;
  if not found or v_order.deleted_at is not null or v_order.order_status<>'draft' or exists(select 1 from public.shopify_releases where source_order_id=s.id) then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  select * into r from public.shopify_draft_reviews where tenant_id=p_tenant_id and source_order_id=s.id and id=p_review_id;
  if not found or r.version<>(select max(version) from public.shopify_draft_reviews where tenant_id=p_tenant_id and source_order_id=s.id) then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select * into v_source from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id order by generation desc limit 1;
  if v_source.id<>r.source_revision_id or v_source.completeness<>'complete' or v_source.source_digest<>p_input->>'sourceDigest'
    or not v_source.sealed_source ? 'ciphertext' or v_source.source_updated_at<>(p_input->>'sourceUpdatedAt')::timestamptz
    or (p_input->>'verifiedAt')::timestamptz>clock_timestamp() or (p_input->>'verifiedAt')::timestamptz<clock_timestamp()-interval '120 seconds'
    or exists(select 1 from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=p_connection_id and order_gid=s.order_gid and requested_generation<>completed_generation)
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  perform 1 from public.customers where tenant_id=p_tenant_id and id=(r.decision->>'customerId')::uuid and deleted_at is null for share;
  if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID';end if;
  if v_order.source_currency_code<>'INR' or p_input->>'moneyValidation'<>'restricted_reconciliation_passed'
    or p_input->>'moneyValidation' is null or p_input->>'sourceCurrency'<>'INR' or p_input->>'sourceCurrency' is null
    or jsonb_array_length(p_input->'lines')<>(select count(*) from public.shopify_source_lines where revision_id=v_source.id and tenant_id=p_tenant_id)
    or exists(select 1 from jsonb_array_elements(p_input->'lines') x group by x->>'lineGid' having count(*)<>1) then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
  -- Existing configuration commands use both type-first and workflow-first
  -- locks. Fail/retry without waiting at that boundary instead of adding a
  -- deadlock cycle; all production rows roll back if configuration is busy.
  -- Mapping edits serialize on the already held connection lock.
  perform w.id from public.workflows w where w.tenant_id=p_tenant_id and w.id in (
    select m.workflow_id from public.shopify_variant_mappings m join jsonb_array_elements(r.decision->'lines') x on m.id=(x->>'mappingId')::uuid
    where m.tenant_id=p_tenant_id and m.connection_id=p_connection_id) order by w.id for share nowait;
  perform sm.id from public.stage_master sm where sm.tenant_id=p_tenant_id and sm.id in (
    select ws.stage_master_id from public.workflow_stages ws join public.shopify_variant_mappings m on m.tenant_id=ws.tenant_id and m.workflow_id=ws.workflow_id
    join jsonb_array_elements(r.decision->'lines') x on m.id=(x->>'mappingId')::uuid
    where ws.tenant_id=p_tenant_id and ws.is_active and ws.deleted_at is null) order by sm.id for share nowait;
  perform ws.id from public.workflow_stages ws where ws.tenant_id=p_tenant_id and ws.is_active and ws.deleted_at is null and ws.workflow_id in (
    select m.workflow_id from public.shopify_variant_mappings m join jsonb_array_elements(r.decision->'lines') x on m.id=(x->>'mappingId')::uuid
    where m.tenant_id=p_tenant_id and m.connection_id=p_connection_id) order by ws.id for share nowait;
  insert into public.shopify_release_capabilities values(pg_backend_pid(),txid_current(),p_tenant_id,s.order_id);
  for v_line in select value from jsonb_array_elements(p_input->'lines') loop
    select value into v_choice from jsonb_array_elements(r.decision->'lines') where value->>'lineGid'=v_line->>'lineGid';
    select * into v_map from public.shopify_variant_mappings where tenant_id=p_tenant_id and connection_id=p_connection_id and id=(v_choice->>'mappingId')::uuid and is_active for share;
    if not found or v_map.revision<>(v_choice->>'mappingRevision')::bigint or v_map.variant_gid is distinct from v_line->>'variantGid'
      or not exists(select 1 from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=v_source.id and line_gid=v_line->>'lineGid' and quantity=(v_line->>'quantity')::integer and current_quantity=quantity)
      then raise exception 'SHOPIFY_MAPPING_INVALID';end if;
    if v_map.classification='nonproduction' then continue;end if;
    if coalesce(v_line->>'productionAllowed','')<>'true' or length(coalesce(btrim(v_line->>'name'),'')) not between 1 and 2000
      or length(coalesce(v_line->>'colour',''))>2000 or length(coalesce(v_line->>'description',''))>10000
      or coalesce(v_line->>'netMinorUnits','') !~ '^(0|[1-9][0-9]{0,11})$' or coalesce(v_line->>'originalUnitMinorUnits','') !~ '^(0|[1-9][0-9]{0,11})$'
      then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
    v_gross:=(v_line->>'originalUnitMinorUnits')::numeric*(v_line->>'quantity')::integer/100;
    v_net:=(v_line->>'netMinorUnits')::numeric/100;
    if v_gross<v_net or v_gross>=10000000000 then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
    perform 1 from public.item_types where tenant_id=p_tenant_id and id=v_map.item_type_id and is_active and deleted_at is null for share nowait;
    if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    perform 1 from public.workflows where tenant_id=p_tenant_id and id=v_map.workflow_id and is_active and deleted_at is null and (item_type_id is null or item_type_id=v_map.item_type_id);
    if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    if v_map.standard_size_id is not null then
      perform 1 from public.item_type_standard_sizes where tenant_id=p_tenant_id and id=v_map.standard_size_id and item_type_id=v_map.item_type_id and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    if not exists(select 1 from public.workflow_stages where tenant_id=p_tenant_id and workflow_id=v_map.workflow_id and is_active and deleted_at is null) then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    insert into public.order_items(tenant_id,order_id,item_type_id,workflow_id,standard_size_id,name,description,color,quantity,unit_price,discount_amount,final_price,expected_completion_date,is_customer_visible,created_by,updated_by)
      values(p_tenant_id,s.order_id,v_map.item_type_id,v_map.workflow_id,v_map.standard_size_id,v_line->>'name',v_line->>'description',v_line->>'colour',(v_line->>'quantity')::integer,
        (v_line->>'originalUnitMinorUnits')::numeric/100,v_gross-v_net,v_net,(v_choice->>'expectedCompletionDate')::date,false,p_actor_id,p_actor_id) returning id into v_item;
    insert into public.item_workflow_instances(tenant_id,order_item_id,workflow_id,created_by,updated_by)
      values(p_tenant_id,v_item,v_map.workflow_id,p_actor_id,p_actor_id) returning id into v_instance;
    v_first:=null;
    for v_config in select ws.*,sm.is_active as master_active,sm.deleted_at as master_deleted,coalesce(ws.customer_status_id,sm.default_customer_status_id) as public_status
      from public.workflow_stages ws left join public.stage_master sm on sm.tenant_id=ws.tenant_id and sm.id=ws.stage_master_id
      where ws.tenant_id=p_tenant_id and ws.workflow_id=v_map.workflow_id and ws.is_active and ws.deleted_at is null order by ws.sequence_number loop
      if not coalesce(v_config.master_active,false) or v_config.master_deleted is not null then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
      if v_config.public_status is not null then
        perform 1 from public.customer_statuses where tenant_id=p_tenant_id and id=v_config.public_status and is_active and deleted_at is null for share nowait;
        if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
      end if;
      insert into public.item_stage_instances(tenant_id,workflow_instance_id,order_item_id,workflow_stage_id,stage_master_id,sequence_number,status,customer_status_id,created_by,updated_by)
        values(p_tenant_id,v_instance,v_item,v_config.id,v_config.stage_master_id,v_config.sequence_number,
          case when v_first is null then 'ready_to_start'::public.item_stage_status else 'not_started'::public.item_stage_status end,v_config.public_status,p_actor_id,p_actor_id) returning id into v_stage;
      if v_first is null then v_first:=v_stage;end if;
    end loop;
    if v_first is null then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    update public.item_workflow_instances set current_stage_instance_id=v_first where tenant_id=p_tenant_id and id=v_instance;
    insert into public.item_history(tenant_id,order_item_id,event_type,new_value_json,notes,created_by)
      values(p_tenant_id,v_item,'shopify_workflow_released',jsonb_build_object('workflow_id',v_map.workflow_id,'workflow_instance_id',v_instance),'Owner released reviewed Shopify production item.',p_actor_id);
    insert into public.shopify_order_item_links values(p_tenant_id,s.id,s.order_id,v_line->>'lineGid',v_item,v_source.id,v_map.id,v_map.revision,clock_timestamp());
    v_count:=v_count+1;v_subtotal:=v_subtotal+v_gross;v_discount:=v_discount+v_gross-v_net;
  end loop;
  if v_count=0 or v_subtotal>=10000000000 then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
  update public.orders set customer_id=(r.decision->>'customerId')::uuid,delivery_type=(r.decision->>'deliveryType')::public.delivery_type,
    promised_delivery_date=(r.decision->>'promisedDeliveryDate')::date,subtotal=v_subtotal,discount_amount=v_discount,total_amount=v_subtotal-v_discount,order_status='confirmed',updated_by=p_actor_id
    where tenant_id=p_tenant_id and id=s.order_id;
  if (p_input->>'verifiedAt')::timestamptz<clock_timestamp()-interval '120 seconds' then raise exception 'SHOPIFY_STALE_REVISION';end if;
  v_result:=jsonb_build_object('status','released','orderId',s.order_id,'sourceRevisionId',v_source.id,'itemCount',v_count);
  insert into public.shopify_releases(tenant_id,source_order_id,source_revision_id,review_id,actor_id,request_key,intent_digest,result)
    values(p_tenant_id,s.id,v_source.id,r.id,p_actor_id,p_request_key,v_hash,v_result);
  delete from public.shopify_release_capabilities where backend_pid=pg_backend_pid() and transaction_id=txid_current() and tenant_id=p_tenant_id and order_id=s.order_id;
  return v_result;
exception when lock_not_available then raise exception 'SHOPIFY_CONFIGURATION_BUSY';
end $$;
revoke all on function public.release_shopify_order(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.release_shopify_order(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) to service_role;
