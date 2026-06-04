create type item_workflow_status as enum ('not_started', 'in_progress', 'completed', 'cancelled');
create type item_stage_status as enum ('not_started', 'ready_to_start', 'in_progress', 'paused', 'completed', 'skipped', 'blocked');
create type item_stage_work_log_status as enum ('in_progress', 'paused', 'completed', 'cancelled');

create table item_workflow_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete restrict,
  status item_workflow_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  current_stage_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

create table item_stage_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  workflow_instance_id uuid not null references item_workflow_instances(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  workflow_stage_id uuid not null references workflow_stages(id) on delete restrict,
  stage_master_id uuid not null references stage_master(id) on delete restrict,
  sequence_number integer not null,
  status item_stage_status not null default 'not_started',
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  customer_status_id uuid references customer_statuses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint item_stage_instances_sequence_positive check (sequence_number > 0)
);

alter table item_workflow_instances
add constraint item_workflow_instances_current_stage_instance_id_fkey
foreign key (current_stage_instance_id)
references item_stage_instances(id)
on delete set null;

create table item_stage_work_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stage_instance_id uuid not null references item_stage_instances(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete restrict,
  workgroup_id uuid references workgroups(id) on delete set null,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  resumed_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  status item_stage_work_log_status not null default 'in_progress',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint item_stage_work_logs_duration_non_negative check (duration_minutes is null or duration_minutes >= 0)
);

create table item_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  event_type text not null,
  old_value_json jsonb,
  new_value_json jsonb,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create trigger item_workflow_instances_set_updated_at
before update on item_workflow_instances
for each row
execute function set_updated_at();

create trigger item_stage_instances_set_updated_at
before update on item_stage_instances
for each row
execute function set_updated_at();

create trigger item_stage_work_logs_set_updated_at
before update on item_stage_work_logs
for each row
execute function set_updated_at();

create unique index item_workflow_instances_tenant_order_item_active_idx
on item_workflow_instances(tenant_id, order_item_id)
where deleted_at is null;

create unique index item_stage_instances_tenant_workflow_sequence_active_idx
on item_stage_instances(tenant_id, workflow_instance_id, sequence_number)
where deleted_at is null;

create index item_workflow_instances_tenant_status_idx on item_workflow_instances(tenant_id, status);
create index item_workflow_instances_tenant_workflow_idx on item_workflow_instances(tenant_id, workflow_id);
create index item_stage_instances_tenant_order_item_idx on item_stage_instances(tenant_id, order_item_id);
create index item_stage_instances_tenant_status_idx on item_stage_instances(tenant_id, status);
create index item_stage_instances_tenant_stage_idx on item_stage_instances(tenant_id, stage_master_id);
create index item_stage_work_logs_tenant_worker_idx on item_stage_work_logs(tenant_id, worker_id);
create index item_stage_work_logs_tenant_stage_instance_idx on item_stage_work_logs(tenant_id, stage_instance_id);
create index item_history_tenant_order_item_idx on item_history(tenant_id, order_item_id, created_at desc);

alter table item_workflow_instances enable row level security;
alter table item_stage_instances enable row level security;
alter table item_stage_work_logs enable row level security;
alter table item_history enable row level security;

comment on table item_workflow_instances is 'Tenant-owned workflow execution instance for an order item.';
comment on table item_stage_instances is 'Tenant-owned stage execution instances generated from workflow stage configuration.';
comment on table item_stage_work_logs is 'Tenant-owned production work logs. Attendance remains separate.';
comment on table item_history is 'Tenant-owned audit history for major item and workflow changes.';
