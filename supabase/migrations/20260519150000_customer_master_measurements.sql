create type customer_gender as enum ('female', 'male', 'other', 'not_specified');

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  gender customer_gender,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint customers_name_not_blank check (length(btrim(name)) > 0)
);

create table customer_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  item_type_id uuid references item_types(id) on delete set null,
  measurement_data_json jsonb not null default '{}'::jsonb,
  notes text,
  photo_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint customer_measurements_data_is_object check (jsonb_typeof(measurement_data_json) = 'object')
);

create trigger customers_set_updated_at
before update on customers
for each row
execute function set_updated_at();

create trigger customer_measurements_set_updated_at
before update on customer_measurements
for each row
execute function set_updated_at();

create index customers_tenant_created_at_idx on customers(tenant_id, created_at desc);
create index customers_tenant_name_idx on customers(tenant_id, lower(name));
create index customers_tenant_phone_idx on customers(tenant_id, phone);
create index customer_measurements_tenant_customer_idx on customer_measurements(tenant_id, customer_id);
create index customer_measurements_tenant_item_type_idx on customer_measurements(tenant_id, item_type_id);
create index customer_measurements_tenant_default_idx on customer_measurements(tenant_id, customer_id, is_default);

alter table customers enable row level security;
alter table customer_measurements enable row level security;

comment on table customers is 'Tenant-owned customer profiles. Duplicates are allowed in MVP; phone is indexed for suggestions but not unique.';
comment on table customer_measurements is 'Tenant-owned customer measurement records with key-value JSON data and attachment-ready photo_url.';
