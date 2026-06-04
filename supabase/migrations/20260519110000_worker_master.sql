create type worker_status as enum ('active', 'inactive');
create type worker_wage_type as enum ('hourly', 'daily', 'weekly', 'monthly', 'per_piece', 'hybrid');

create table workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  phone text,
  joining_date date,
  status worker_status not null default 'active',
  primary_workgroup_id uuid references workgroups(id) on delete set null,
  wage_type worker_wage_type not null default 'monthly',
  wage_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint workers_wage_amount_non_negative check (wage_amount >= 0)
);

create table worker_workgroups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  workgroup_id uuid not null references workgroups(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  unique (tenant_id, worker_id, workgroup_id)
);

create trigger workers_set_updated_at
before update on workers
for each row
execute function set_updated_at();

create index workers_tenant_status_idx on workers(tenant_id, status);
create index workers_tenant_name_idx on workers(tenant_id, name);
create index workers_tenant_primary_workgroup_idx on workers(tenant_id, primary_workgroup_id);
create index worker_workgroups_tenant_worker_idx on worker_workgroups(tenant_id, worker_id);
create index worker_workgroups_tenant_workgroup_idx on worker_workgroups(tenant_id, workgroup_id);

alter table workers enable row level security;
alter table worker_workgroups enable row level security;

comment on table workers is 'Tenant-owned operational workers. Workers are not login users in MVP.';
comment on table worker_workgroups is 'Tenant-owned worker to workgroup memberships used for future stage assignment validation.';
