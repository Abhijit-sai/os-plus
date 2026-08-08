do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_tenant_id_id_unique'
  ) then
    alter table public.orders
      add constraint orders_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workflows_tenant_id_id_unique'
  ) then
    alter table public.workflows
      add constraint workflows_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workflow_stages_tenant_id_id_unique'
  ) then
    alter table public.workflow_stages
      add constraint workflow_stages_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stage_master_tenant_id_id_unique'
  ) then
    alter table public.stage_master
      add constraint stage_master_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customer_statuses_tenant_id_id_unique'
  ) then
    alter table public.customer_statuses
      add constraint customer_statuses_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workers_tenant_id_id_unique'
  ) then
    alter table public.workers
      add constraint workers_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workgroups_tenant_id_id_unique'
  ) then
    alter table public.workgroups
      add constraint workgroups_tenant_id_id_unique unique (tenant_id, id);
  end if;
end $$;

alter table public.orders
  add column if not exists vertical_key text,
  add column if not exists runtime_model text;

update public.orders
set
  vertical_key = coalesce(vertical_key, 'boutique'),
  runtime_model = coalesce(runtime_model, 'legacy_item_v1'),
  updated_at = now()
where vertical_key is null
   or runtime_model is null;

alter table public.orders
  alter column vertical_key set default 'boutique',
  alter column runtime_model set default 'legacy_item_v1',
  alter column vertical_key set not null,
  alter column runtime_model set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_vertical_key_check'
  ) then
    alter table public.orders
      add constraint orders_vertical_key_check
      check (vertical_key in ('boutique', 'laundry'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_runtime_model_check'
  ) then
    alter table public.orders
      add constraint orders_runtime_model_check
      check (runtime_model in ('legacy_item_v1', 'work_unit_v2'));
  end if;
end $$;

create index if not exists orders_tenant_runtime_model_idx
on public.orders(tenant_id, runtime_model);

create index if not exists orders_tenant_vertical_key_idx
on public.orders(tenant_id, vertical_key);

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null,
  line_type text not null default 'service',
  name text not null,
  description text,
  quantity numeric(12, 3) not null default 1,
  quantity_unit text not null default 'unit',
  unit_price numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  gst_treatment gst_treatment not null default 'not_applicable',
  gst_rate numeric(5, 2) not null default 0,
  estimated_amount numeric(12, 2),
  final_amount numeric(12, 2),
  source_vertical_key text,
  source_object_type text,
  source_object_id uuid,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint order_lines_order_tenant_fkey
    foreign key (tenant_id, order_id)
    references orders(tenant_id, id)
    on delete cascade,
  constraint order_lines_tenant_id_id_unique unique (tenant_id, id),
  constraint order_lines_line_type_check check (line_type in ('service', 'product', 'fee', 'discount', 'other')),
  constraint order_lines_name_not_blank check (length(btrim(name)) > 0),
  constraint order_lines_quantity_positive check (quantity > 0),
  constraint order_lines_sort_order_positive check (sort_order > 0),
  constraint order_lines_amounts_non_negative check (
    unit_price >= 0
    and discount_amount >= 0
    and gst_rate >= 0
    and (estimated_amount is null or estimated_amount >= 0)
    and (final_amount is null or final_amount >= 0)
  ),
  constraint order_lines_source_vertical_key_check
    check (source_vertical_key is null or source_vertical_key in ('boutique', 'laundry'))
);

create trigger order_lines_set_updated_at
before update on order_lines
for each row
execute function set_updated_at();

create index order_lines_tenant_order_idx on order_lines(tenant_id, order_id);
create index order_lines_tenant_source_idx on order_lines(tenant_id, source_vertical_key, source_object_type, source_object_id);
create index order_lines_tenant_sort_idx on order_lines(tenant_id, order_id, sort_order);

create table work_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null,
  order_line_id uuid,
  vertical_key text not null,
  vertical_object_type text,
  vertical_object_id uuid,
  display_code text not null,
  workflow_id uuid not null,
  current_workflow_instance_id uuid,
  status text not null default 'not_started',
  customer_status_id uuid,
  current_location_id uuid,
  expected_completion_at timestamptz,
  production_completed_at timestamptz,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint work_units_order_tenant_fkey
    foreign key (tenant_id, order_id)
    references orders(tenant_id, id)
    on delete cascade,
  constraint work_units_order_line_tenant_fkey
    foreign key (tenant_id, order_line_id)
    references order_lines(tenant_id, id)
    on delete restrict,
  constraint work_units_workflow_tenant_fkey
    foreign key (tenant_id, workflow_id)
    references workflows(tenant_id, id)
    on delete restrict,
  constraint work_units_customer_status_tenant_fkey
    foreign key (tenant_id, customer_status_id)
    references customer_statuses(tenant_id, id)
    on delete restrict,
  constraint work_units_location_tenant_fkey
    foreign key (tenant_id, current_location_id)
    references tenant_locations(tenant_id, id)
    on delete restrict,
  constraint work_units_tenant_id_id_unique unique (tenant_id, id),
  constraint work_units_vertical_key_check check (vertical_key in ('boutique', 'laundry')),
  constraint work_units_display_code_not_blank check (length(btrim(display_code)) > 0),
  constraint work_units_status_check check (status in ('not_started', 'in_progress', 'blocked', 'production_complete', 'cancelled')),
  constraint work_units_blocked_reason_check check (status <> 'blocked' or blocked_reason is not null)
);

create trigger work_units_set_updated_at
before update on work_units
for each row
execute function set_updated_at();

create unique index work_units_tenant_display_code_active_idx
on work_units(tenant_id, lower(display_code))
where deleted_at is null;

create index work_units_tenant_order_idx on work_units(tenant_id, order_id);
create index work_units_tenant_order_line_idx on work_units(tenant_id, order_line_id);
create index work_units_tenant_status_idx on work_units(tenant_id, status);
create index work_units_tenant_expected_completion_idx on work_units(tenant_id, expected_completion_at);
create index work_units_tenant_location_idx on work_units(tenant_id, current_location_id);
create index work_units_tenant_workflow_idx on work_units(tenant_id, workflow_id);

create table work_unit_workflow_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  work_unit_id uuid not null,
  workflow_id uuid not null,
  status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  current_stage_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint work_unit_workflow_instances_work_unit_tenant_fkey
    foreign key (tenant_id, work_unit_id)
    references work_units(tenant_id, id)
    on delete cascade,
  constraint work_unit_workflow_instances_workflow_tenant_fkey
    foreign key (tenant_id, workflow_id)
    references workflows(tenant_id, id)
    on delete restrict,
  constraint work_unit_workflow_instances_tenant_id_id_unique unique (tenant_id, id),
  constraint work_unit_workflow_instances_status_check check (status in ('not_started', 'in_progress', 'completed', 'cancelled'))
);

create trigger work_unit_workflow_instances_set_updated_at
before update on work_unit_workflow_instances
for each row
execute function set_updated_at();

create unique index work_unit_workflow_instances_tenant_work_unit_active_idx
on work_unit_workflow_instances(tenant_id, work_unit_id)
where deleted_at is null and status in ('not_started', 'in_progress');

create index work_unit_workflow_instances_tenant_status_idx on work_unit_workflow_instances(tenant_id, status);
create index work_unit_workflow_instances_tenant_workflow_idx on work_unit_workflow_instances(tenant_id, workflow_id);

create table work_unit_stage_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  workflow_instance_id uuid not null,
  work_unit_id uuid not null,
  workflow_stage_id uuid not null,
  stage_master_id uuid not null,
  sequence_number integer not null,
  status item_stage_status not null default 'not_started',
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  customer_status_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint work_unit_stage_instances_workflow_instance_tenant_fkey
    foreign key (tenant_id, workflow_instance_id)
    references work_unit_workflow_instances(tenant_id, id)
    on delete cascade,
  constraint work_unit_stage_instances_work_unit_tenant_fkey
    foreign key (tenant_id, work_unit_id)
    references work_units(tenant_id, id)
    on delete cascade,
  constraint work_unit_stage_instances_workflow_stage_tenant_fkey
    foreign key (tenant_id, workflow_stage_id)
    references workflow_stages(tenant_id, id)
    on delete restrict,
  constraint work_unit_stage_instances_stage_master_tenant_fkey
    foreign key (tenant_id, stage_master_id)
    references stage_master(tenant_id, id)
    on delete restrict,
  constraint work_unit_stage_instances_customer_status_tenant_fkey
    foreign key (tenant_id, customer_status_id)
    references customer_statuses(tenant_id, id)
    on delete set null,
  constraint work_unit_stage_instances_tenant_id_id_unique unique (tenant_id, id),
  constraint work_unit_stage_instances_sequence_positive check (sequence_number > 0)
);

alter table work_unit_workflow_instances
add constraint work_unit_workflow_instances_current_stage_instance_id_fkey
foreign key (tenant_id, current_stage_instance_id)
references work_unit_stage_instances(tenant_id, id)
on delete restrict;

alter table work_units
add constraint work_units_current_workflow_instance_tenant_fkey
foreign key (tenant_id, current_workflow_instance_id)
references work_unit_workflow_instances(tenant_id, id)
on delete restrict;

create trigger work_unit_stage_instances_set_updated_at
before update on work_unit_stage_instances
for each row
execute function set_updated_at();

create unique index work_unit_stage_instances_tenant_workflow_sequence_active_idx
on work_unit_stage_instances(tenant_id, workflow_instance_id, sequence_number)
where deleted_at is null;

create index work_unit_stage_instances_tenant_work_unit_idx on work_unit_stage_instances(tenant_id, work_unit_id);
create index work_unit_stage_instances_tenant_status_idx on work_unit_stage_instances(tenant_id, status);
create index work_unit_stage_instances_tenant_stage_idx on work_unit_stage_instances(tenant_id, stage_master_id);

create table work_unit_stage_work_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stage_instance_id uuid not null,
  work_unit_id uuid not null,
  worker_id uuid not null,
  workgroup_id uuid,
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
  constraint work_unit_stage_work_logs_stage_instance_tenant_fkey
    foreign key (tenant_id, stage_instance_id)
    references work_unit_stage_instances(tenant_id, id)
    on delete cascade,
  constraint work_unit_stage_work_logs_work_unit_tenant_fkey
    foreign key (tenant_id, work_unit_id)
    references work_units(tenant_id, id)
    on delete cascade,
  constraint work_unit_stage_work_logs_worker_tenant_fkey
    foreign key (tenant_id, worker_id)
    references workers(tenant_id, id)
    on delete restrict,
  constraint work_unit_stage_work_logs_workgroup_tenant_fkey
    foreign key (tenant_id, workgroup_id)
    references workgroups(tenant_id, id)
    on delete restrict,
  constraint work_unit_stage_work_logs_duration_non_negative
    check (duration_minutes is null or duration_minutes >= 0)
);

create trigger work_unit_stage_work_logs_set_updated_at
before update on work_unit_stage_work_logs
for each row
execute function set_updated_at();

create index work_unit_stage_work_logs_tenant_worker_idx on work_unit_stage_work_logs(tenant_id, worker_id);
create index work_unit_stage_work_logs_tenant_work_unit_idx on work_unit_stage_work_logs(tenant_id, work_unit_id);
create index work_unit_stage_work_logs_tenant_stage_instance_idx on work_unit_stage_work_logs(tenant_id, stage_instance_id);

alter table order_lines enable row level security;
alter table work_units enable row level security;
alter table work_unit_workflow_instances enable row level security;
alter table work_unit_stage_instances enable row level security;
alter table work_unit_stage_work_logs enable row level security;

comment on column orders.vertical_key is 'V2 runtime discriminator. Existing Boutique orders are boutique.';
comment on column orders.runtime_model is 'Runtime model discriminator. Existing Boutique orders use legacy_item_v1.';
comment on table order_lines is 'Tenant-owned V2 commercial order lines. Production state belongs to Work Units, not Order Lines.';
comment on table work_units is 'Tenant-owned V2 operational production units for Laundry and future verticals.';
comment on table work_unit_workflow_instances is 'Tenant-owned V2 workflow execution instance for a Work Unit.';
comment on table work_unit_stage_instances is 'Tenant-owned V2 stage execution instances generated from workflow stage configuration.';
comment on table work_unit_stage_work_logs is 'Tenant-owned V2 Work Unit production work logs. Attendance remains separate.';

create or replace function initialize_work_unit_workflow(
  p_tenant_id uuid,
  p_work_unit_id uuid,
  p_actor text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_unit work_units%rowtype;
  v_existing_instance_id uuid;
  v_workflow_instance_id uuid;
  v_first_stage_instance_id uuid;
begin
  select *
  into v_work_unit
  from work_units
  where tenant_id = p_tenant_id
    and id = p_work_unit_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORK_UNIT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  perform 1
  from workflows
  where tenant_id = p_tenant_id
    and id = v_work_unit.workflow_id
    and is_active = true
    and deleted_at is null;

  if not found then
    raise exception 'WORKFLOW_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  select id
  into v_existing_instance_id
  from work_unit_workflow_instances
  where tenant_id = p_tenant_id
    and work_unit_id = p_work_unit_id
    and deleted_at is null
    and status in ('not_started', 'in_progress')
  limit 1;

  if v_existing_instance_id is not null then
    return v_existing_instance_id;
  end if;

  perform 1
  from workflow_stages
  where tenant_id = p_tenant_id
    and workflow_id = v_work_unit.workflow_id
    and is_active = true
    and deleted_at is null
  limit 1;

  if not found then
    raise exception 'WORKFLOW_HAS_NO_ACTIVE_STAGES'
      using errcode = 'P0001';
  end if;

  insert into work_unit_workflow_instances (
    tenant_id,
    work_unit_id,
    workflow_id,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_work_unit_id,
    v_work_unit.workflow_id,
    'not_started',
    p_actor,
    p_actor
  )
  returning id into v_workflow_instance_id;

  insert into work_unit_stage_instances (
    tenant_id,
    workflow_instance_id,
    work_unit_id,
    workflow_stage_id,
    stage_master_id,
    sequence_number,
    status,
    customer_status_id,
    created_by,
    updated_by
  )
  select
    p_tenant_id,
    v_workflow_instance_id,
    p_work_unit_id,
    workflow_stages.id,
    workflow_stages.stage_master_id,
    workflow_stages.sequence_number,
    case
      when row_number() over (order by workflow_stages.sequence_number, workflow_stages.created_at) = 1
        then 'ready_to_start'::item_stage_status
      else 'not_started'::item_stage_status
    end,
    workflow_stages.customer_status_id,
    p_actor,
    p_actor
  from workflow_stages
  where workflow_stages.tenant_id = p_tenant_id
    and workflow_stages.workflow_id = v_work_unit.workflow_id
    and workflow_stages.is_active = true
    and workflow_stages.deleted_at is null
  order by workflow_stages.sequence_number, workflow_stages.created_at;

  select id
  into v_first_stage_instance_id
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and workflow_instance_id = v_workflow_instance_id
    and deleted_at is null
  order by sequence_number
  limit 1;

  update work_unit_workflow_instances
  set
    current_stage_instance_id = v_first_stage_instance_id,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_workflow_instance_id;

  update work_units
  set
    current_workflow_instance_id = v_workflow_instance_id,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = p_work_unit_id;

  return v_workflow_instance_id;
end;
$$;

comment on function initialize_work_unit_workflow(uuid, uuid, text)
is 'Atomically initializes the configured V2 Work Unit workflow and first ready stage. Domain Events are added in V2-3.';
