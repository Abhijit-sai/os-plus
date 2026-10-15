-- Dormant fenced import only. No registration/enablement, seed, or release.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_tenant_id_id_unique') then
    alter table public.orders add constraint orders_tenant_id_id_unique unique(tenant_id,id);
  end if;
end $$;
-- Activation attestations default false/null and service-role bare writes remain
-- revoked. A future audited owner/setup command must record actual scope/privacy
-- verification and the destination's source-copy approval before enabling this.
alter table public.shopify_connections
  add column draft_import_enabled boolean not null default false,
  add column scopes_verified_at timestamptz,
  add column protected_customer_fields_verified_at timestamptz,
  add column source_copy_authorized_at timestamptz,
  add constraint shopify_draft_activation_ready check(not draft_import_enabled or
    (scopes_verified_at is not null and isfinite(scopes_verified_at)
      and protected_customer_fields_verified_at is not null and isfinite(protected_customer_fields_verified_at)
      and source_copy_authorized_at is not null and isfinite(source_copy_authorized_at)));
alter table public.orders
  add column financial_management text not null default 'local'
    check (financial_management in ('local','external_shopify')),
  add column source_currency_code text not null default 'INR'
    check (source_currency_code ~ '^[A-Z]{3}$'),
  alter column customer_id drop not null,
  alter column delivery_type drop not null,
  -- NOT VALID preserves legacy rows for a separate read-only cross-tenant audit;
  -- PostgreSQL nevertheless enforces it on every new/changed relationship.
  add constraint orders_customer_tenant_fk foreign key (tenant_id,customer_id)
    references public.customers(tenant_id,id) on delete restrict not valid,
  add constraint orders_customer_and_delivery_required check (
    (customer_id is not null and delivery_type is not null) or (source='shopify' and order_status='draft')),
  add constraint orders_shopify_dormant_boundary check (
    (source<>'shopify' and financial_management='local' and order_status<>'draft') or
    (source='shopify' and financial_management='external_shopify' and order_status='draft'
      and subtotal=0 and discount_amount=0 and total_amount=0 and amount_paid=0
      and gst_amount=0 and taxable_amount=0 and gst_rate=0 and gst_treatment='not_applicable' and payment_status='unpaid'));

-- Shared read boundary for ALL existing operational/finance/public consumers.
-- This slice deliberately has no Shopify review UI and no released Shopify
-- orders. A later release slice must introduce separately authorized projections,
-- never expand the local-accounting view to include external money.
create view public.local_operational_orders with (security_invoker=true) as
  select * from public.orders where source<>'shopify' and financial_management='local'
    and order_status<>'draft' and customer_id is not null and delivery_type is not null;
revoke all on public.local_operational_orders from public,anon,authenticated;
grant select on public.local_operational_orders to service_role;

create table public.shopify_source_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, connection_id uuid not null,
  shop_gid text not null, order_gid text not null check (order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),
  order_id uuid not null, created_at timestamptz not null default now(),
  unique(tenant_id,id), unique(tenant_id,shop_gid,order_gid), unique(order_id),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict
);
create table public.shopify_source_revisions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, source_order_id uuid not null,
  job_id uuid not null, generation bigint not null check(generation>0 and generation<=9007199254740991),
  source_updated_at timestamptz not null, observed_at timestamptz not null,
  source_digest text not null check(source_digest ~ '^[0-9a-f]{64}$'),
  sealed_source jsonb not null check(jsonb_typeof(sealed_source)='object'),
  review_reasons jsonb not null check(jsonb_typeof(review_reasons)='array'),
  completeness text not null default 'complete' check(completeness in ('partial','complete')),
  source_customer_gid text check(source_customer_gid ~ '^gid://shopify/Customer/[1-9][0-9]{0,31}$'),
  created_at timestamptz not null default now(), unique(tenant_id,id), unique(job_id,generation),
  foreign key(tenant_id,source_order_id) references public.shopify_source_orders(tenant_id,id) on delete restrict,
  foreign key(tenant_id,job_id) references public.shopify_sync_jobs(tenant_id,id) on delete restrict
);
create table public.shopify_source_lines (
  tenant_id uuid not null, revision_id uuid not null,
  line_gid text not null check(line_gid ~ '^gid://shopify/LineItem/[1-9][0-9]{0,31}$'),
  quantity integer not null check(quantity>0), current_quantity integer not null check(current_quantity>=0 and current_quantity<=quantity),
  primary key(revision_id,line_gid),
  foreign key(tenant_id,revision_id) references public.shopify_source_revisions(tenant_id,id) on delete restrict
);
-- Verified store-scoped runtime links are separate from the legacy CSV identity
-- index. Never silently assign unscoped CSV identities to this shop or break its
-- existing ON CONFLICT contract. Legacy index/scope migration remains gated.
create table public.shopify_customer_bindings (
  tenant_id uuid not null, shop_gid text not null, identity_key text not null,
  customer_id uuid not null, generated_name boolean not null default false,
  created_at timestamptz not null default now(), primary key(tenant_id,shop_gid,identity_key),
  foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict,
  check(shop_gid ~ '^gid://shopify/Shop/[1-9][0-9]{0,31}$'),
  check(identity_key ~ '^gid://shopify/(Customer|Order)/[1-9][0-9]{0,31}$')
);
create table public.shopify_draft_import_results (
  tenant_id uuid not null, connection_id uuid not null, job_id uuid not null, generation bigint not null,
  intent_digest text not null check(intent_digest ~ '^[0-9a-f]{64}$'), result jsonb not null,
  created_at timestamptz not null default now(), primary key(job_id,generation),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,job_id) references public.shopify_sync_jobs(tenant_id,id) on delete restrict
);
create function public.protect_shopify_draft_audit() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'SHOPIFY_AUDIT_IMMUTABLE'; end $$;
do $$ declare v_table text; begin
  foreach v_table in array array['shopify_source_orders','shopify_source_revisions','shopify_source_lines','shopify_customer_bindings','shopify_draft_import_results'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    execute format('grant select on public.%I to service_role',v_table);
    execute format('create trigger shopify_draft_immutable before update or delete on public.%I for each row execute function public.protect_shopify_draft_audit()',v_table);
  end loop;
end $$;

create function public.guard_shopify_draft_order() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' and new.source='shopify' and current_user <>
    pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass)) then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
  if tg_op='DELETE' and old.source='shopify' then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
  if tg_op='UPDATE' and (old.source='shopify' or new.source='shopify') then
    -- Only the table owner's definer command may resolve customer/currency.
    -- No session-variable bypass; ordinary service-role order actions are fenced.
    if (to_jsonb(new)-array['updated_at','updated_by','deleted_at','customer_id','source_currency_code']) is distinct from
       (to_jsonb(old)-array['updated_at','updated_by','deleted_at','customer_id','source_currency_code'])
       or (new.customer_id is distinct from old.customer_id and
         current_user <> pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass)))
       or (new.source_currency_code is distinct from old.source_currency_code and
         (old.source<>'shopify' or old.order_status<>'draft' or old.source_currency_code<>'XXX' or new.source_currency_code='XXX'
           or current_user <> pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass)))) then
      raise exception 'SHOPIFY_DRAFT_LOCKED';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_shopify_draft_order before insert or update or delete on public.orders
  for each row execute function public.guard_shopify_draft_order();

create function public.guard_shopify_order_child() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare v_new jsonb; v_old jsonb; v_order uuid; v_tenant uuid; v_key text;
begin
  v_key:=case when tg_table_name='receivables_payables' then 'linked_order_id' else 'order_id' end;
  if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
  if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
  -- Check BOTH parents when moving a child. Lock the order to serialize against
  -- lifecycle changes, and use the tenant pair instead of the legacy UUID FK.
  for v_order,v_tenant in select distinct (x->>v_key)::uuid,(x->>'tenant_id')::uuid
    from (values(v_new),(v_old)) as records(x) where x->>v_key is not null order by 1,2 loop
    perform 1 from public.orders where id=v_order and tenant_id=v_tenant and source='shopify' for update;
    if found then raise exception 'SHOPIFY_ORDER_READ_ONLY'; end if;
    if exists(select 1 from public.orders where id=v_order and tenant_id<>v_tenant) then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  end loop;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare v_table text; begin
  foreach v_table in array array['order_items','order_payments','order_lines','work_units','communication_message_queue','receivables_payables'] loop
    if to_regclass('public.'||v_table) is not null then
      execute format('create trigger guard_shopify_order_child before insert or update or delete on public.%I for each row execute function public.guard_shopify_order_child()',v_table);
    end if;
  end loop;
end $$;

-- Service-only trusted snapshot input. NOT a browser/n8n endpoint. Encryption,
-- installed-store credentials and protected-field attestations are server gates.
create function public.import_shopify_draft(p_input jsonb,p_recovery_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_tenant uuid; v_conn uuid; v_job_id uuid; v_generation bigint; v_token uuid; v_revision bigint;
  v_connection public.shopify_connections%rowtype; v_job public.shopify_sync_jobs%rowtype;
  v_source public.shopify_source_orders%rowtype; v_order public.orders%rowtype;
  v_prior public.shopify_draft_import_results%rowtype; v_intent text; v_now timestamptz;
  v_customer jsonb; v_customer_id uuid; v_id_customer uuid; v_phone_customer uuid;
  v_profile public.customers%rowtype; v_identity text; v_phone text; v_email text;
  v_resolution text:='review'; v_reasons jsonb; v_revision_id uuid; v_result jsonb;
  v_created timestamptz; v_updated timestamptz; v_observed timestamptz;
  v_partial boolean; v_address jsonb;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>16777216 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  v_tenant:=(p_input->>'tenantId')::uuid; v_conn:=(p_input->>'connectionId')::uuid;
  v_job_id:=(p_input->>'jobId')::uuid; v_generation:=(p_input->>'generation')::bigint;
  v_revision:=(p_input->>'connectionRevision')::bigint; v_token:=(p_input->>'leaseToken')::uuid;
  v_created:=(p_input->>'sourceCreatedAt')::timestamptz; v_updated:=(p_input->>'sourceUpdatedAt')::timestamptz; v_observed:=(p_input->>'observedAt')::timestamptz;
  v_customer:=p_input->'customer'; v_phone:=nullif(v_customer->>'verifiedPhoneE164',''); v_email:=nullif(btrim(v_customer->>'emailSuggestion'),'');
  v_partial:=coalesce(p_input->>'completeness','complete')='partial';
  if v_tenant is null or v_conn is null or v_job_id is null or v_token is null or v_generation is null or v_generation<1
    or v_revision is null or v_revision<1 or v_generation>9007199254740991 or v_revision>9007199254740991
    or p_input->>'environment' is distinct from 'production' or p_input->>'apiVersion' is distinct from '2026-10'
    or p_input->>'sourceOrderGid' is null or p_input->>'sourceOrderGid' !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'
    or p_input->>'sourceCurrency' is null or p_input->>'sourceCurrency' !~ '^[A-Z]{3}$'
    or p_input->>'sourceDigest' is null or p_input->>'sourceDigest' !~ '^[0-9a-f]{64}$'
    or v_created is null or v_updated is null or v_observed is null or not isfinite(v_created) or not isfinite(v_updated) or not isfinite(v_observed)
    or jsonb_typeof(v_customer) is distinct from 'object' or length(btrim(v_customer->>'proposedName')) not between 1 and 1024
    or v_customer->>'proposedName' is null or jsonb_typeof(v_customer->'generatedName') is distinct from 'boolean'
    or jsonb_typeof(v_customer->'phoneCountryConflict') is distinct from 'boolean'
    or not (v_customer ? 'unverifiedPrimaryPhone') or jsonb_typeof(v_customer->'unverifiedPrimaryPhone') not in ('null','string')
    or length(coalesce(v_customer->>'unverifiedPrimaryPhone',''))>1024 or p_recovery_only is null
    or (v_customer->>'shopifyCustomerGid' is not null and v_customer->>'shopifyCustomerGid' !~ '^gid://shopify/Customer/[1-9][0-9]{0,31}$')
    or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$') or length(coalesce(v_email,''))>1024
    or coalesce(p_input->>'completeness','complete') not in ('partial','complete')
    or jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines') not between 0 and 500
    or (not v_partial and jsonb_array_length(p_input->'lines')=0)
    or (v_partial and (jsonb_array_length(p_input->'lines')<>0 or v_customer->>'shopifyCustomerGid' is not null
      or v_phone is not null or v_email is not null or v_customer->>'unverifiedPrimaryPhone' is not null
      or p_input->>'sourceCurrency'<>'XXX'))
    or (p_input ? 'addresses' and (jsonb_typeof(p_input->'addresses') is distinct from 'array' or jsonb_array_length(p_input->'addresses')>2))
    or jsonb_typeof(p_input->'reasons') is distinct from 'array' or jsonb_array_length(p_input->'reasons')>40
    or jsonb_typeof(p_input->'sealedSource') is distinct from 'object'
    or p_input->'sealedSource'->>'version' is distinct from '1' or length(coalesce(p_input->'sealedSource'->>'keyId','')) not between 1 and 64
    or length(coalesce(p_input->'sealedSource'->>'iv',''))<>16 or length(coalesce(p_input->'sealedSource'->>'tag',''))<>24
    or length(coalesce(p_input->'sealedSource'->>'ciphertext','')) not between 1 and 12000000 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_input->'lines') x where jsonb_typeof(x)<>'object'
    or x->>'lineGid' is null or x->>'lineGid' !~ '^gid://shopify/LineItem/[1-9][0-9]{0,31}$'
    or (x->>'quantity')::integer is null or (x->>'quantity')::integer<=0 or (x->>'currentQuantity')::integer is null
    or (x->>'currentQuantity')::integer<0 or (x->>'currentQuantity')::integer>(x->>'quantity')::integer)
    or exists(select 1 from jsonb_array_elements(p_input->'lines') x group by x->>'lineGid' having count(*)>1)
    or exists(select 1 from jsonb_array_elements_text(p_input->'reasons') x where x !~ '^[A-Z_]+$' or length(x)>80)
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  -- Ciphertext uses random IVs; hash normalized intent, not ciphertext, so a
  -- lost response can be recovered after resealing the same trusted source.
  v_intent:=encode(sha256(convert_to((p_input-'sealedSource')::text,'UTF8')),'hex');
  select * into v_connection from public.shopify_connections where tenant_id=v_tenant and id=v_conn
    and environment=p_input->>'environment' and app_ref=p_input->>'appRef' and shop_gid=p_input->>'shopGid'
    and canonical_domain=p_input->>'shopDomain' for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  select * into v_prior from public.shopify_draft_import_results where tenant_id=v_tenant and connection_id=v_conn and job_id=v_job_id and generation=v_generation;
  if found then
    if v_prior.intent_digest<>v_intent then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return v_prior.result;
  end if;
  -- An expired/lost-response retry may ONLY recover an existing exact intent.
  -- This branch never creates/enriches a profile/order or completes a job.
  if p_recovery_only then return null; end if;
  perform 1 from public.tenants where id=v_tenant and status='active' for share;
  if not found or v_connection.revision<>v_revision or v_connection.status<>'verified' or not v_connection.intake_enabled or not v_connection.processing_enabled
    or not v_connection.draft_import_enabled or v_connection.scopes_verified_at is null or v_connection.protected_customer_fields_verified_at is null
    or v_connection.source_copy_authorized_at is null then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  -- Same serialization key as the existing CSV import, before source/order.
  perform pg_advisory_xact_lock(hashtextextended('customer-import:'||v_tenant::text,0));
  select * into v_job from public.shopify_sync_jobs where tenant_id=v_tenant and connection_id=v_conn and id=v_job_id
    and order_gid=p_input->>'sourceOrderGid' for update;
  v_now:=clock_timestamp();
  if not found or v_job.lease_token is distinct from v_token or v_job.claimed_generation is distinct from v_generation
    or v_job.claimed_connection_revision is distinct from v_revision or v_job.lease_expires_at<=v_now or v_job.dead_lettered_at is not null
    or v_job.first_attempt_at<=v_now-interval '24 hours' then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  if v_created<v_connection.import_created_at_cutoff or v_updated<v_created or v_observed>v_now
    or v_observed<v_now-interval '120 seconds' then raise exception 'SHOPIFY_SOURCE_CHANGED'; end if;
  select * into v_source from public.shopify_source_orders where tenant_id=v_tenant and shop_gid=v_connection.shop_gid and order_gid=v_job.order_gid for update;
  if found then
    select * into v_order from public.orders where tenant_id=v_tenant and id=v_source.order_id for update;
    if v_order.deleted_at is not null or v_order.order_status<>'draft' then raise exception 'SHOPIFY_DRAFT_LOCKED'; end if;
    if exists(select 1 from public.shopify_source_revisions where tenant_id=v_tenant and source_order_id=v_source.id and source_updated_at>v_updated) then raise exception 'SHOPIFY_SOURCE_CHANGED'; end if;
  end if;
  v_reasons:=p_input->'reasons';
  if v_partial then v_reasons:=v_reasons||'"INCOMPLETE_SOURCE"'::jsonb;
  else
  if nullif(btrim(v_customer->>'unverifiedPrimaryPhone'),'') is not null then v_reasons:=v_reasons||'"UNVERIFIED_PHONE"'::jsonb; end if;
  if (v_customer->>'phoneCountryConflict')::boolean then v_reasons:=v_reasons||'"PHONE_COUNTRY_CONFLICT"'::jsonb; end if;
  v_identity:=coalesce(v_customer->>'shopifyCustomerGid',case when v_phone is null then v_job.order_gid end);
  if v_identity is not null then select customer_id into v_id_customer from public.shopify_customer_bindings where tenant_id=v_tenant and shop_gid=v_connection.shop_gid and identity_key=v_identity; end if;
  if v_phone is not null then select id into v_phone_customer from public.customers where tenant_id=v_tenant and normalized_phone_e164=v_phone and deleted_at is null for update; end if;
  if v_customer->>'shopifyCustomerGid' is null and
    (nullif(btrim(v_customer->>'unverifiedPrimaryPhone'),'') is not null or (v_customer->>'phoneCountryConflict')::boolean) then
    v_reasons:=v_reasons||'"CUSTOMER_PHONE_REVIEW"'::jsonb;
  elsif v_id_customer is not null then
    select * into v_profile from public.customers where tenant_id=v_tenant and id=v_id_customer for update;
    if v_profile.deleted_at is not null then v_reasons:=v_reasons||'"CUSTOMER_DELETED"'::jsonb;
    elsif v_phone_customer is not null and v_phone_customer<>v_id_customer then v_reasons:=v_reasons||'"CUSTOMER_ID_PHONE_CONFLICT"'::jsonb;
    else
      v_customer_id:=v_id_customer; v_resolution:='reused';
      if v_phone is not null and v_profile.normalized_phone_e164 is not null and v_profile.normalized_phone_e164<>v_phone then v_reasons:=v_reasons||'"CUSTOMER_PHONE_CHANGED"'::jsonb; end if;
      if v_phone is not null and v_profile.normalized_phone_e164 is null and nullif(btrim(v_profile.phone),'') is not null then v_reasons:=v_reasons||'"CUSTOMER_PHONE_UNVERIFIED"'::jsonb; end if;
    end if;
  elsif v_phone_customer is not null then v_customer_id:=v_phone_customer; v_resolution:='reused';
  elsif v_phone is not null and exists(select 1 from public.customers where tenant_id=v_tenant and normalized_phone_e164=v_phone and deleted_at is not null) then v_reasons:=v_reasons||'"CUSTOMER_DELETED"'::jsonb;
  elsif v_email is not null and exists(select 1 from public.customers where tenant_id=v_tenant and lower(btrim(email))=lower(v_email) and deleted_at is null) then v_reasons:=v_reasons||'"CUSTOMER_EMAIL_REVIEW"'::jsonb;
  elsif v_customer->>'shopifyCustomerGid' is not null and exists(select 1 from public.customer_external_identities where tenant_id=v_tenant and provider='shopify'
    and external_customer_id in (v_customer->>'shopifyCustomerGid',split_part(v_customer->>'shopifyCustomerGid','/',5))) then v_reasons:=v_reasons||'"LEGACY_IDENTITY_REVIEW"'::jsonb;
  else
    insert into public.customers(tenant_id,name,phone,normalized_phone_e164,email,created_by,updated_by)
      values(v_tenant,v_customer->>'proposedName',v_phone,v_phone,v_email,'shopify-import','shopify-import')
      on conflict(tenant_id,normalized_phone_e164) where deleted_at is null and normalized_phone_e164 is not null do nothing returning id into v_customer_id;
    if v_customer_id is null then
      select id into v_customer_id from public.customers where tenant_id=v_tenant and normalized_phone_e164=v_phone and deleted_at is null for update;
      if v_customer_id is null then raise exception 'SHOPIFY_SOURCE_CHANGED'; end if;
      v_resolution:='reused';
    else v_resolution:='created'; end if;
  end if;
  if v_customer_id is not null then
    -- Blanks only, never overwrite a name, populated phone, email or address.
    update public.customers set email=case when nullif(btrim(email),'') is null then v_email else email end,
      phone=case when nullif(btrim(phone),'') is null and (normalized_phone_e164 is null or normalized_phone_e164=v_phone) then v_phone else phone end,
      normalized_phone_e164=case when nullif(btrim(phone),'') is null then coalesce(normalized_phone_e164,v_phone) else normalized_phone_e164 end,updated_by='shopify-import'
      where tenant_id=v_tenant and id=v_customer_id and (nullif(btrim(email),'') is null and v_email is not null
        or nullif(btrim(phone),'') is null and v_phone is not null and (normalized_phone_e164 is null or normalized_phone_e164=v_phone));
    if v_identity is not null then
      insert into public.shopify_customer_bindings(tenant_id,shop_gid,identity_key,customer_id,generated_name)
        values(v_tenant,v_connection.shop_gid,v_identity,v_customer_id,(v_customer->>'generatedName')::boolean)
        on conflict(tenant_id,shop_gid,identity_key) do nothing;
      if not exists(select 1 from public.shopify_customer_bindings where tenant_id=v_tenant and shop_gid=v_connection.shop_gid and identity_key=v_identity and customer_id=v_customer_id) then raise exception 'SHOPIFY_SOURCE_CHANGED'; end if;
    end if;
  else v_reasons:=v_reasons||'"CUSTOMER_RESOLUTION_REQUIRED"'::jsonb; end if;
  end if;
  -- Same tenant-import advisory lock plus the resolved customer row serialize
  -- enrichment. Existing dedupe/default policy: line1+postal, never replace a
  -- populated/default address. Source shipping/billing remain encrypted facts.
  if v_customer_id is not null and not v_partial then
    for v_address in select value from jsonb_array_elements(coalesce(p_input->'addresses','[]'::jsonb)) loop
      if jsonb_typeof(v_address)<>'object' or length(coalesce(btrim(v_address->>'address1'),'')) not between 1 and 2048
        or coalesce(v_address->>'countryCodeV2','') !~ '^[A-Z]{2}$'
        or length(coalesce(v_address->>'address2',''))>2048 or length(coalesce(v_address->>'city',''))>256
        or length(coalesce(v_address->>'province',''))>256 or length(coalesce(v_address->>'zip',''))>128 then
        raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
      if not exists(select 1 from public.customer_addresses where tenant_id=v_tenant and customer_id=v_customer_id and deleted_at is null
        and lower(btrim(address_line_1))=lower(btrim(v_address->>'address1'))
        and coalesce(lower(btrim(postal_code)),'')=coalesce(lower(btrim(v_address->>'zip')),'')) then
        insert into public.customer_addresses(tenant_id,customer_id,label,address_line_1,address_line_2,city,state,postal_code,country_code,is_default,source,created_by,updated_by)
          values(v_tenant,v_customer_id,'Shopify import',btrim(v_address->>'address1'),nullif(btrim(v_address->>'address2'),''),nullif(btrim(v_address->>'city'),''),
            nullif(btrim(v_address->>'province'),''),nullif(btrim(v_address->>'zip'),''),v_address->>'countryCodeV2',
            not exists(select 1 from public.customer_addresses where tenant_id=v_tenant and customer_id=v_customer_id and is_default and deleted_at is null),
            'shopify_import','shopify-import','shopify-import');
      end if;
    end loop;
  end if;
  if v_source.id is null then
    insert into public.orders(tenant_id,order_number,source,customer_id,order_date,delivery_type,financial_management,source_currency_code,order_status,tracking_token,created_by)
      values(v_tenant,'','shopify',v_customer_id,(v_created at time zone 'Asia/Kolkata')::date,null,'external_shopify',p_input->>'sourceCurrency','draft',gen_random_uuid()::text,'shopify-import') returning * into v_order;
    insert into public.shopify_source_orders(tenant_id,connection_id,shop_gid,order_gid,order_id)
      values(v_tenant,v_conn,v_connection.shop_gid,v_job.order_gid,v_order.id) returning * into v_source;
  elsif v_order.customer_id is null and v_customer_id is not null then
    update public.orders set customer_id=v_customer_id,updated_by='shopify-import' where tenant_id=v_tenant and id=v_order.id;
  elsif v_order.customer_id is not null and v_customer_id is distinct from v_order.customer_id then
    -- No silent replacement of a previously accepted buyer on a source edit.
    v_reasons:=v_reasons||'"CUSTOMER_ORDER_LINK_REVIEW"'::jsonb;
  end if;
  if not v_partial and v_order.source_currency_code='XXX' and p_input->>'sourceCurrency'<>'XXX' then
    update public.orders set source_currency_code=p_input->>'sourceCurrency',updated_by='shopify-import'
      where tenant_id=v_tenant and id=v_order.id;
  elsif not v_partial and v_order.source_currency_code is distinct from p_input->>'sourceCurrency' then
    v_reasons:=v_reasons||'"CURRENCY_CHANGED"'::jsonb;
  end if;
  v_reasons:=(select coalesce(jsonb_agg(reason order by reason),'[]'::jsonb) from (select distinct value as reason from jsonb_array_elements_text(v_reasons)) r);
  insert into public.shopify_source_revisions(tenant_id,source_order_id,job_id,generation,source_updated_at,observed_at,source_digest,sealed_source,review_reasons,completeness,source_customer_gid)
    values(v_tenant,v_source.id,v_job_id,v_generation,v_updated,v_observed,p_input->>'sourceDigest',p_input->'sealedSource',v_reasons,case when v_partial then 'partial' else 'complete' end,v_customer->>'shopifyCustomerGid') returning id into v_revision_id;
  insert into public.shopify_source_lines(tenant_id,revision_id,line_gid,quantity,current_quantity)
    select v_tenant,v_revision_id,x->>'lineGid',(x->>'quantity')::integer,(x->>'currentQuantity')::integer from jsonb_array_elements(p_input->'lines') x;
  -- Recheck wall clock at commit boundary after all possible lock waits/writes.
  if v_job.lease_expires_at<=clock_timestamp() or v_observed<clock_timestamp()-interval '120 seconds' then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  v_result:=jsonb_build_object('status','draft','orderId',v_order.id,'sourceRevisionId',v_revision_id,'tenantId',v_tenant,
    'customerId',v_customer_id,'customerResolution',v_resolution,'reasons',v_reasons,'releaseEligible',false);
  insert into public.shopify_draft_import_results(tenant_id,connection_id,job_id,generation,intent_digest,result)
    values(v_tenant,v_conn,v_job_id,v_generation,v_intent,v_result);
  update public.shopify_sync_jobs set completed_generation=v_generation,lease_token=null,lease_expires_at=null,claimed_generation=null,
    claimed_connection_revision=null,last_error_code=null,attempts=0,first_attempt_at=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
    where tenant_id=v_tenant and id=v_job_id;
  return v_result;
end $$;
create function public.recover_shopify_draft(p_input jsonb) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.import_shopify_draft(p_input,true);
$$;
revoke all on function public.import_shopify_draft(jsonb,boolean),public.recover_shopify_draft(jsonb),public.protect_shopify_draft_audit(),public.guard_shopify_draft_order(),public.guard_shopify_order_child() from public,anon,authenticated;
grant execute on function public.import_shopify_draft(jsonb,boolean),public.recover_shopify_draft(jsonb) to service_role;
comment on table public.shopify_source_revisions is 'Immutable encrypted source snapshot and review audit, never local accounting or a public DTO.';
comment on table public.shopify_draft_import_results is 'Atomic immutable command receipt; no PII or money in results. Retained after soft deletion.';
