create table workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  item_type_id uuid references item_types(id) on delete set null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table workflow_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  stage_master_id uuid not null references stage_master(id) on delete restrict,
  sequence_number integer not null,
  is_mandatory boolean not null default true,
  expected_duration_hours numeric(8, 2),
  customer_status_id uuid references customer_statuses(id) on delete set null,
  requires_attachment boolean not null default false,
  allows_multiple_workers boolean not null default true,
  parent_stage_id uuid references workflow_stages(id) on delete set null,
  parallel_group_id text,
  dependency_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint workflow_stages_sequence_positive check (sequence_number > 0),
  constraint workflow_stages_duration_positive check (expected_duration_hours is null or expected_duration_hours >= 0)
);

create table stage_workgroups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stage_master_id uuid not null references stage_master(id) on delete cascade,
  workgroup_id uuid not null references workgroups(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  unique (tenant_id, stage_master_id, workgroup_id)
);

alter table item_types
add constraint item_types_default_workflow_id_fkey
foreign key (default_workflow_id)
references workflows(id)
on delete set null;

create trigger workflows_set_updated_at
before update on workflows
for each row
execute function set_updated_at();

create trigger workflow_stages_set_updated_at
before update on workflow_stages
for each row
execute function set_updated_at();

create unique index workflows_tenant_name_active_idx
on workflows(tenant_id, lower(name))
where deleted_at is null;

create unique index workflow_stages_tenant_workflow_sequence_idx
on workflow_stages(tenant_id, workflow_id, sequence_number)
where deleted_at is null;

create unique index workflow_stages_tenant_workflow_stage_idx
on workflow_stages(tenant_id, workflow_id, stage_master_id)
where deleted_at is null;

create index workflows_tenant_active_idx on workflows(tenant_id, is_active);
create index workflows_tenant_item_type_idx on workflows(tenant_id, item_type_id);
create index workflow_stages_tenant_workflow_idx on workflow_stages(tenant_id, workflow_id);
create index workflow_stages_tenant_stage_idx on workflow_stages(tenant_id, stage_master_id);
create index stage_workgroups_tenant_stage_idx on stage_workgroups(tenant_id, stage_master_id);
create index stage_workgroups_tenant_workgroup_idx on stage_workgroups(tenant_id, workgroup_id);

alter table workflows enable row level security;
alter table workflow_stages enable row level security;
alter table stage_workgroups enable row level security;

comment on table workflows is 'Tenant-owned workflow definitions assigned at order item level.';
comment on table workflow_stages is 'Tenant-owned ordered workflow stage configuration. MVP uses sequence_number; parallel fields are reserved.';
comment on table stage_workgroups is 'Tenant-owned allowed workgroups for each internal stage.';
