create table vertical_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vertical_definitions_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint vertical_definitions_name_not_blank check (length(btrim(name)) > 0)
);

create trigger vertical_definitions_set_updated_at
before update on vertical_definitions
for each row
execute function set_updated_at();

insert into vertical_definitions (key, name, description)
values
  ('boutique', 'Boutique', 'Legacy Boutique vertical using the existing item workflow runtime.'),
  ('laundry', 'Laundry', 'Laundry vertical using the V2 Work Unit runtime.')
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

alter table tenants
add constraint tenants_tenant_id_unique unique (id);

alter table tenant_users
add constraint tenant_users_tenant_id_id_unique unique (tenant_id, id);

alter table customers
add constraint customers_tenant_id_id_unique unique (tenant_id, id);

create table tenant_verticals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vertical_definition_id uuid not null references vertical_definitions(id) on delete restrict,
  is_enabled boolean not null default true,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  constraint tenant_verticals_enabled_at_required check (not is_enabled or enabled_at is not null),
  constraint tenant_verticals_tenant_definition_unique unique (tenant_id, vertical_definition_id)
);

create trigger tenant_verticals_set_updated_at
before update on tenant_verticals
for each row
execute function set_updated_at();

insert into tenant_verticals (
  tenant_id,
  vertical_definition_id,
  is_enabled,
  enabled_at,
  created_by
)
select
  tenants.id,
  vertical_definitions.id,
  true,
  now(),
  'v2_phase_1_backfill'
from tenants
cross join vertical_definitions
where vertical_definitions.key = 'boutique'
on conflict (tenant_id, vertical_definition_id) do update
set
  is_enabled = true,
  enabled_at = coalesce(tenant_verticals.enabled_at, excluded.enabled_at),
  updated_by = 'v2_phase_1_backfill',
  updated_at = now();

create table tenant_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text not null,
  name text not null,
  location_type text not null default 'store',
  address_line_1 text,
  address_line_2 text,
  area text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'IN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint tenant_locations_code_not_blank check (length(btrim(code)) > 0),
  constraint tenant_locations_name_not_blank check (length(btrim(name)) > 0),
  constraint tenant_locations_location_type_check check (location_type in ('store', 'workshop', 'warehouse', 'office', 'other')),
  constraint tenant_locations_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint tenant_locations_tenant_id_id_unique unique (tenant_id, id)
);

create trigger tenant_locations_set_updated_at
before update on tenant_locations
for each row
execute function set_updated_at();

create unique index tenant_locations_tenant_code_active_idx
on tenant_locations(tenant_id, lower(code))
where deleted_at is null;

create index tenant_locations_tenant_active_idx on tenant_locations(tenant_id, is_active);
create index tenant_locations_tenant_type_idx on tenant_locations(tenant_id, location_type);

create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null,
  label text not null,
  address_line_1 text not null,
  address_line_2 text,
  area text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'IN',
  landmark text,
  notes text,
  is_default boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint customer_addresses_customer_tenant_fkey
    foreign key (tenant_id, customer_id)
    references customers(tenant_id, id)
    on delete cascade,
  constraint customer_addresses_label_not_blank check (length(btrim(label)) > 0),
  constraint customer_addresses_line_1_not_blank check (length(btrim(address_line_1)) > 0),
  constraint customer_addresses_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint customer_addresses_source_check check (source in ('manual', 'legacy_customer_address', 'whatsapp', 'pickup')),
  constraint customer_addresses_tenant_id_id_unique unique (tenant_id, id)
);

create trigger customer_addresses_set_updated_at
before update on customer_addresses
for each row
execute function set_updated_at();

create unique index customer_addresses_one_default_active_idx
on customer_addresses(tenant_id, customer_id)
where deleted_at is null and is_default;

create index customer_addresses_tenant_customer_idx on customer_addresses(tenant_id, customer_id);
create index customer_addresses_tenant_source_idx on customer_addresses(tenant_id, source);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  location_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint teams_location_tenant_fkey
    foreign key (tenant_id, location_id)
    references tenant_locations(tenant_id, id)
    on delete set null,
  constraint teams_name_not_blank check (length(btrim(name)) > 0),
  constraint teams_code_not_blank check (length(btrim(code)) > 0),
  constraint teams_tenant_id_id_unique unique (tenant_id, id)
);

create trigger teams_set_updated_at
before update on teams
for each row
execute function set_updated_at();

create unique index teams_tenant_code_active_idx
on teams(tenant_id, lower(code))
where deleted_at is null;

create index teams_tenant_active_idx on teams(tenant_id, is_active);
create index teams_tenant_location_idx on teams(tenant_id, location_id);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null,
  tenant_user_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text,
  deleted_at timestamptz,
  constraint team_members_team_tenant_fkey
    foreign key (tenant_id, team_id)
    references teams(tenant_id, id)
    on delete cascade,
  constraint team_members_user_tenant_fkey
    foreign key (tenant_id, tenant_user_id)
    references tenant_users(tenant_id, id)
    on delete cascade
);

create unique index team_members_active_member_idx
on team_members(tenant_id, team_id, tenant_user_id)
where deleted_at is null;

create index team_members_tenant_user_idx on team_members(tenant_id, tenant_user_id, is_active);
create index team_members_tenant_team_idx on team_members(tenant_id, team_id, is_active);

alter table vertical_definitions enable row level security;
alter table tenant_verticals enable row level security;
alter table tenant_locations enable row level security;
alter table customer_addresses enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;

comment on table vertical_definitions is 'Platform-owned vertical capability definitions. Initial keys are boutique and laundry.';
comment on table tenant_verticals is 'Tenant vertical enablement. Do not infer verticals from tenant slug, name, item types or workflows.';
comment on table tenant_locations is 'Tenant-owned operational locations such as stores, workshops, warehouses and offices.';
comment on table customer_addresses is 'Tenant-owned customer addresses. Existing customers.address remains for Boutique compatibility.';
comment on table teams is 'Tenant-owned operational teams. Teams route work but do not replace authorization roles.';
comment on table team_members is 'Tenant-owned operational team membership. Role permissions remain separately enforced.';
