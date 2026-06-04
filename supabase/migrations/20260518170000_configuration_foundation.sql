create table customer_statuses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_final_status boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table item_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  default_workflow_id uuid,
  default_sla_days integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint item_types_default_sla_days_positive check (default_sla_days is null or default_sla_days >= 0)
);

create table stage_master (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  default_customer_status_id uuid references customer_statuses(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table workgroups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table payment_modes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create trigger customer_statuses_set_updated_at
before update on customer_statuses
for each row
execute function set_updated_at();

create trigger item_types_set_updated_at
before update on item_types
for each row
execute function set_updated_at();

create trigger stage_master_set_updated_at
before update on stage_master
for each row
execute function set_updated_at();

create trigger workgroups_set_updated_at
before update on workgroups
for each row
execute function set_updated_at();

create trigger payment_modes_set_updated_at
before update on payment_modes
for each row
execute function set_updated_at();

create trigger expense_categories_set_updated_at
before update on expense_categories
for each row
execute function set_updated_at();

create unique index customer_statuses_tenant_name_active_idx
on customer_statuses(tenant_id, lower(name))
where deleted_at is null;

create unique index item_types_tenant_name_active_idx
on item_types(tenant_id, lower(name))
where deleted_at is null;

create unique index stage_master_tenant_name_active_idx
on stage_master(tenant_id, lower(name))
where deleted_at is null;

create unique index workgroups_tenant_name_active_idx
on workgroups(tenant_id, lower(name))
where deleted_at is null;

create unique index payment_modes_tenant_name_active_idx
on payment_modes(tenant_id, lower(name))
where deleted_at is null;

create unique index expense_categories_tenant_name_active_idx
on expense_categories(tenant_id, lower(name))
where deleted_at is null;

create index customer_statuses_tenant_sort_idx on customer_statuses(tenant_id, sort_order);
create index item_types_tenant_active_idx on item_types(tenant_id, is_active);
create index stage_master_tenant_active_idx on stage_master(tenant_id, is_active);
create index workgroups_tenant_active_idx on workgroups(tenant_id, is_active);
create index payment_modes_tenant_active_idx on payment_modes(tenant_id, is_active);
create index expense_categories_tenant_active_idx on expense_categories(tenant_id, is_active);

alter table customer_statuses enable row level security;
alter table item_types enable row level security;
alter table stage_master enable row level security;
alter table workgroups enable row level security;
alter table payment_modes enable row level security;
alter table expense_categories enable row level security;

comment on table customer_statuses is 'Tenant-owned customer-facing status labels, separate from internal workflow stages.';
comment on table item_types is 'Tenant-owned item type master records.';
comment on table stage_master is 'Tenant-owned internal production stage master records.';
comment on table workgroups is 'Tenant-owned worker capability groups.';
comment on table payment_modes is 'Tenant-owned payment mode master records.';
comment on table expense_categories is 'Tenant-owned expense category master records.';
