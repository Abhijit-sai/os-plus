alter table customers
add column normalized_phone_e164 text;

alter table customers
add constraint customers_normalized_phone_e164_format
check (normalized_phone_e164 is null or normalized_phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

update customers
set normalized_phone_e164 = case
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
    then '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'
    then '+91' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2)
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
    then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0091[6-9][0-9]{9}$'
    then '+' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 3)
  else null
end
where phone is not null and btrim(phone) <> '' and normalized_phone_e164 is null;

do $$
begin
  if exists (
    select 1 from customers
    where deleted_at is null
      and phone is not null
      and btrim(phone) <> ''
      and normalized_phone_e164 is null
  ) then
    raise exception 'CUSTOMER_PHONE_BACKFILL_REQUIRES_REVIEW' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from customers
    where deleted_at is null and normalized_phone_e164 is not null
    group by tenant_id, normalized_phone_e164
    having count(*) > 1
  ) then
    raise exception 'CUSTOMER_PHONE_COLLISIONS_REQUIRE_REVIEW' using errcode = 'P0001';
  end if;
end;
$$;

create unique index customers_tenant_normalized_phone_active_idx
on customers(tenant_id, normalized_phone_e164)
where deleted_at is null and normalized_phone_e164 is not null;

alter table customer_addresses drop constraint customer_addresses_source_check;
alter table customer_addresses
add constraint customer_addresses_source_check
check (source in ('manual', 'legacy_customer_address', 'whatsapp', 'pickup', 'shopify_import'));

create table customer_external_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null,
  provider text not null,
  external_customer_id text not null,
  source_metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint customer_external_identities_customer_tenant_fkey
    foreign key (tenant_id, customer_id)
    references customers(tenant_id, id)
    on delete cascade,
  constraint customer_external_identities_provider_not_blank check (length(btrim(provider)) > 0),
  constraint customer_external_identities_external_id_not_blank check (length(btrim(external_customer_id)) > 0),
  constraint customer_external_identities_metadata_object check (jsonb_typeof(source_metadata_json) = 'object'),
  constraint customer_external_identities_tenant_id_id_unique unique (tenant_id, id)
);

create trigger customer_external_identities_set_updated_at
before update on customer_external_identities
for each row execute function set_updated_at();

create unique index customer_external_identities_active_source_idx
on customer_external_identities(tenant_id, provider, external_customer_id)
where deleted_at is null;
create index customer_external_identities_tenant_customer_idx
on customer_external_identities(tenant_id, customer_id);
alter table customer_external_identities enable row level security;

create table customer_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  preview_fingerprint text not null,
  idempotency_key uuid not null,
  source_row_count integer not null,
  created_count integer not null default 0,
  reused_count integer not null default 0,
  updated_count integer not null default 0,
  address_count integer not null default 0,
  invalid_count integer not null default 0,
  skipped_count integer not null default 0,
  result_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint customer_imports_file_name_not_blank check (length(btrim(file_name)) > 0),
  constraint customer_imports_file_hash_check check (file_hash ~ '^[0-9a-f]{64}$'),
  constraint customer_imports_preview_fingerprint_check check (preview_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint customer_imports_counts_check check (
    source_row_count >= 0 and created_count >= 0 and reused_count >= 0 and updated_count >= 0
    and address_count >= 0 and invalid_count >= 0 and skipped_count >= 0
  ),
  constraint customer_imports_tenant_idempotency_unique unique (tenant_id, idempotency_key)
);

create index customer_imports_tenant_created_idx on customer_imports(tenant_id, created_at desc);
alter table customer_imports enable row level security;
create trigger customer_imports_immutable
before update or delete on customer_imports
for each row execute function prevent_immutable_audit_change();

comment on column customers.normalized_phone_e164 is
  'Canonical E.164 phone used for tenant-scoped matching and active-customer uniqueness.';
comment on table customers is
  'Tenant-owned customer profiles. Active canonical E.164 phone values are unique within each tenant.';
comment on table customer_external_identities is
  'Tenant-scoped external customer identities and inert source metadata. Metadata is not reporting or messaging consent.';
comment on table customer_imports is
  'Immutable receipts for atomic, idempotent customer file confirmations. Preview performs no writes.';

create or replace function import_customer_rows(
  p_tenant_id uuid,
  p_file_name text,
  p_file_hash text,
  p_preview_fingerprint text,
  p_idempotency_key uuid,
  p_source_row_count integer,
  p_invalid_count integer,
  p_skipped_count integer,
  p_rows jsonb,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_import customer_imports%rowtype;
  v_row record;
  v_customer customers%rowtype;
  v_external_customer_id uuid;
  v_phone_customer_id uuid;
  v_customer_id uuid;
  v_created integer := 0;
  v_reused integer := 0;
  v_updated integer := 0;
  v_addresses integer := 0;
  v_result jsonb;
  v_before customers%rowtype;
begin
  if p_tenant_id is null or not exists (select 1 from tenants where id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  if p_file_name is null or btrim(p_file_name) = '' then raise exception 'FILE_NAME_REQUIRED' using errcode = 'P0001'; end if;
  if p_actor_id is null or btrim(p_actor_id) = '' then raise exception 'ACTOR_REQUIRED' using errcode = 'P0001'; end if;
  if p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_FILE_HASH' using errcode = 'P0001'; end if;
  if p_preview_fingerprint is null or p_preview_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_PREVIEW_FINGERPRINT' using errcode = 'P0001'; end if;
  if p_source_row_count is null or p_invalid_count is null or p_skipped_count is null
    or p_source_row_count < 0 or p_source_row_count > 5000 or p_invalid_count < 0 or p_skipped_count < 0
    or p_invalid_count + p_skipped_count > p_source_row_count then
    raise exception 'INVALID_IMPORT_COUNTS' using errcode = 'P0001';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 5000 then
    raise exception 'INVALID_CUSTOMER_ROWS' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) + p_invalid_count + p_skipped_count <> p_source_row_count then
    raise exception 'IMPORT_ROW_COUNTS_DO_NOT_RECONCILE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('customer-import:' || p_tenant_id::text, 0));
  select * into v_existing_import from customer_imports
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_import.file_hash <> p_file_hash or v_existing_import.preview_fingerprint <> p_preview_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH' using errcode = 'P0001';
    end if;
    return v_existing_import.result_json || jsonb_build_object('idempotentReplay', true);
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as item(normalized_phone_e164 text)
    where item.normalized_phone_e164 is not null
    group by item.normalized_phone_e164 having count(*) > 1
  ) then raise exception 'DUPLICATE_SOURCE_PHONE' using errcode = 'P0001'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as item(shopify_customer_id text)
    where item.shopify_customer_id is not null
    group by item.shopify_customer_id having count(*) > 1
  ) then raise exception 'DUPLICATE_SOURCE_SHOPIFY_ID' using errcode = 'P0001'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as item(row_number integer)
    group by item.row_number having item.row_number is null or count(*) > 1
  ) then raise exception 'DUPLICATE_OR_MISSING_SOURCE_ROW_NUMBER' using errcode = 'P0001'; end if;

  for v_row in
    select * from jsonb_to_recordset(p_rows) as item(
      row_number integer,
      decision text,
      customer_id uuid,
      name text,
      phone text,
      normalized_phone_e164 text,
      email text,
      legacy_address_text text,
      notes text,
      shopify_customer_id text,
      address jsonb,
      source_metadata jsonb
    ) order by item.row_number
  loop
    if v_row.row_number is null or v_row.row_number < 2
      or v_row.decision not in ('create', 'reuse')
      or v_row.name is null or btrim(v_row.name) = ''
      or (v_row.normalized_phone_e164 is not null and v_row.normalized_phone_e164 !~ '^\+[1-9][0-9]{7,14}$')
      or (v_row.phone is not null and length(v_row.phone) > 40)
      or (v_row.email is not null and (length(v_row.email) > 320 or v_row.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
      or (v_row.source_metadata is not null and jsonb_typeof(v_row.source_metadata) <> 'object')
      or (v_row.address is not null and jsonb_typeof(v_row.address) <> 'object')
      or (v_row.address is not null and coalesce(v_row.address ->> 'countryCode', 'IN') !~ '^[A-Z]{2}$')
    then raise exception 'INVALID_CUSTOMER_ROW:%', coalesce(v_row.row_number, 0) using errcode = 'P0001'; end if;

    v_external_customer_id := null;
    v_phone_customer_id := null;
    if v_row.shopify_customer_id is not null then
      select customer_id into v_external_customer_id
      from customer_external_identities
      where tenant_id = p_tenant_id and provider = 'shopify'
        and external_customer_id = btrim(v_row.shopify_customer_id) and deleted_at is null
      for update;
    end if;
    if v_row.normalized_phone_e164 is not null then
      select id into v_phone_customer_id from customers
      where tenant_id = p_tenant_id and normalized_phone_e164 = v_row.normalized_phone_e164 and deleted_at is null
      for update;
    end if;
    if v_external_customer_id is not null and v_phone_customer_id is not null and v_external_customer_id <> v_phone_customer_id then
      raise exception 'EXTERNAL_ID_PHONE_CUSTOMER_CONFLICT:%', v_row.row_number using errcode = 'P0001';
    end if;

    v_customer_id := coalesce(v_external_customer_id, v_phone_customer_id, v_row.customer_id);
    if v_row.decision = 'create' and v_customer_id is not null then
      raise exception 'PREVIEW_STALE_CUSTOMER_MATCH:%', v_row.row_number using errcode = 'P0001';
    end if;
    if v_row.decision = 'reuse' then
      if v_row.customer_id is null or v_customer_id is distinct from v_row.customer_id then
        raise exception 'PREVIEW_STALE_REUSE_TARGET:%', v_row.row_number using errcode = 'P0001';
      end if;
      select * into v_customer from customers
      where tenant_id = p_tenant_id and id = v_customer_id and deleted_at is null for update;
      if not found then raise exception 'CUSTOMER_NOT_ACTIVE_IN_TENANT:%', v_row.row_number using errcode = 'P0001'; end if;
      v_before := v_customer;
      update customers set
        phone = case when phone is null or btrim(phone) = '' then v_row.phone else phone end,
        normalized_phone_e164 = coalesce(normalized_phone_e164, v_row.normalized_phone_e164),
        email = case when email is null or btrim(email) = '' then v_row.email else email end,
        address = case when address is null or btrim(address) = '' then v_row.legacy_address_text else address end,
        notes = case when notes is null or btrim(notes) = '' then v_row.notes else notes end,
        updated_by = p_actor_id
      where tenant_id = p_tenant_id and id = v_customer_id;
      if v_before.phone is distinct from coalesce(nullif(v_before.phone, ''), v_row.phone)
        or v_before.email is distinct from coalesce(nullif(v_before.email, ''), v_row.email)
        or v_before.address is distinct from coalesce(nullif(v_before.address, ''), v_row.legacy_address_text)
        or v_before.notes is distinct from coalesce(nullif(v_before.notes, ''), v_row.notes)
      then v_updated := v_updated + 1; end if;
      v_reused := v_reused + 1;
    else
      begin
        insert into customers (
          tenant_id, name, phone, normalized_phone_e164, email, address, notes, created_by, updated_by
        ) values (
          p_tenant_id, btrim(v_row.name), v_row.phone, v_row.normalized_phone_e164,
          v_row.email, v_row.legacy_address_text, v_row.notes, p_actor_id, p_actor_id
        ) returning id into v_customer_id;
        v_created := v_created + 1;
      exception when unique_violation then
        if v_row.normalized_phone_e164 is null then raise; end if;
        select id into v_customer_id from customers
        where tenant_id = p_tenant_id and normalized_phone_e164 = v_row.normalized_phone_e164 and deleted_at is null;
        if v_customer_id is null then raise; end if;
        v_reused := v_reused + 1;
      end;
    end if;

    if v_row.address is not null and nullif(btrim(v_row.address ->> 'addressLine1'), '') is not null then
      if not exists (
        select 1 from customer_addresses
        where tenant_id = p_tenant_id and customer_id = v_customer_id and deleted_at is null
          and lower(btrim(address_line_1)) = lower(btrim(v_row.address ->> 'addressLine1'))
          and coalesce(lower(btrim(postal_code)), '') = coalesce(lower(btrim(v_row.address ->> 'postalCode')), '')
      ) then
        insert into customer_addresses (
          tenant_id, customer_id, label, address_line_1, address_line_2, city, state, postal_code,
          country_code, is_default, source, created_by, updated_by
        ) values (
          p_tenant_id, v_customer_id, 'Shopify import', btrim(v_row.address ->> 'addressLine1'),
          nullif(btrim(v_row.address ->> 'addressLine2'), ''), nullif(btrim(v_row.address ->> 'city'), ''),
          nullif(btrim(v_row.address ->> 'state'), ''), nullif(btrim(v_row.address ->> 'postalCode'), ''),
          coalesce(nullif(upper(btrim(v_row.address ->> 'countryCode')), ''), 'IN'),
          not exists (select 1 from customer_addresses where tenant_id = p_tenant_id and customer_id = v_customer_id and is_default and deleted_at is null),
          'shopify_import', p_actor_id, p_actor_id
        );
        v_addresses := v_addresses + 1;
      end if;
    end if;

    if v_row.shopify_customer_id is not null then
      insert into customer_external_identities (
        tenant_id, customer_id, provider, external_customer_id, source_metadata_json, created_by, updated_by
      ) values (
        p_tenant_id, v_customer_id, 'shopify', btrim(v_row.shopify_customer_id), coalesce(v_row.source_metadata, '{}'::jsonb), p_actor_id, p_actor_id
      )
      on conflict (tenant_id, provider, external_customer_id) where deleted_at is null
      do update set
        source_metadata_json = excluded.source_metadata_json,
        updated_by = excluded.updated_by;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'createdCount', v_created,
    'reusedCount', v_reused,
    'updatedCount', v_updated,
    'addressCount', v_addresses,
    'invalidCount', p_invalid_count,
    'skippedCount', p_skipped_count,
    'idempotentReplay', false
  );
  insert into customer_imports (
    tenant_id, file_name, file_hash, preview_fingerprint, idempotency_key, source_row_count,
    created_count, reused_count, updated_count, address_count, invalid_count, skipped_count,
    result_json, created_by
  ) values (
    p_tenant_id, btrim(p_file_name), p_file_hash, p_preview_fingerprint, p_idempotency_key, p_source_row_count,
    v_created, v_reused, v_updated, v_addresses, p_invalid_count, p_skipped_count, v_result, p_actor_id
  );
  return v_result;
end;
$$;

revoke all on function import_customer_rows(uuid, text, text, text, uuid, integer, integer, integer, jsonb, text)
from public, anon, authenticated;
grant execute on function import_customer_rows(uuid, text, text, text, uuid, integer, integer, integer, jsonb, text)
to service_role;
