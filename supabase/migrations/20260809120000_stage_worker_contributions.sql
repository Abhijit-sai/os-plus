create type stage_effort_tracking_mode as enum ('none', 'units', 'hours', 'hybrid');
create type item_stage_contribution_method as enum ('per_unit', 'per_hour', 'percentage');
create type contribution_allocation_basis as enum ('units', 'hours');

alter table stage_master
add column effort_tracking_mode stage_effort_tracking_mode not null default 'none';

create table item_type_stage_contribution_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_type_id uuid not null references item_types(id) on delete cascade,
  stage_master_id uuid not null references stage_master(id) on delete cascade,
  calculation_method item_stage_contribution_method not null,
  rate_value numeric(12, 4) not null,
  percentage_allocation_basis contribution_allocation_basis,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint item_type_stage_contribution_rules_rate_positive check (rate_value > 0),
  constraint item_type_stage_contribution_rules_percentage_range check (
    calculation_method <> 'percentage' or rate_value <= 100
  ),
  constraint item_type_stage_contribution_rules_allocation_basis check (
    (calculation_method = 'per_unit' and percentage_allocation_basis = 'units')
    or (calculation_method = 'per_hour' and percentage_allocation_basis = 'hours')
    or (calculation_method = 'percentage' and percentage_allocation_basis is not null)
  )
);

create unique index item_type_stage_contribution_rules_active_idx
on item_type_stage_contribution_rules(tenant_id, item_type_id, stage_master_id)
where deleted_at is null;
create index item_type_stage_contribution_rules_tenant_item_type_idx
on item_type_stage_contribution_rules(tenant_id, item_type_id);
create index item_type_stage_contribution_rules_tenant_stage_idx
on item_type_stage_contribution_rules(tenant_id, stage_master_id);
create trigger item_type_stage_contribution_rules_set_updated_at
before update on item_type_stage_contribution_rules
for each row execute function set_updated_at();
alter table item_type_stage_contribution_rules enable row level security;

alter table item_stage_instances
add column effort_tracking_mode_snapshot stage_effort_tracking_mode,
add column contribution_rule_id_snapshot uuid references item_type_stage_contribution_rules(id) on delete set null,
add column contribution_method_snapshot item_stage_contribution_method,
add column contribution_rate_snapshot numeric(12, 4),
add column contribution_allocation_basis_snapshot contribution_allocation_basis,
add column contribution_item_value_snapshot numeric(12, 2),
add column contribution_pool_snapshot numeric(12, 2),
add column contribution_revision bigint not null default 0;

alter table item_stage_instances
add constraint item_stage_instances_contribution_snapshot_non_negative check (
  (contribution_rate_snapshot is null or contribution_rate_snapshot > 0)
  and (contribution_item_value_snapshot is null or contribution_item_value_snapshot >= 0)
  and (contribution_pool_snapshot is null or contribution_pool_snapshot >= 0)
);

alter table item_stage_work_logs
add column credited_units numeric(12, 2) not null default 0,
add column credited_minutes integer not null default 0,
add column calculated_contribution_amount numeric(12, 2) not null default 0,
add column updated_by text;

alter table item_stage_work_logs
add constraint item_stage_work_logs_credited_units_non_negative check (credited_units >= 0),
add constraint item_stage_work_logs_credited_units_tenth_step check (mod(credited_units * 100, 10) = 0),
add constraint item_stage_work_logs_credited_minutes_non_negative check (credited_minutes >= 0),
add constraint item_stage_work_logs_credited_minutes_ten_step check (mod(credited_minutes, 10) = 0),
add constraint item_stage_work_logs_contribution_amount_non_negative check (calculated_contribution_amount >= 0);

create table item_stage_contribution_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stage_instance_id uuid not null references item_stage_instances(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  reason text not null,
  old_value_json jsonb not null,
  new_value_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint item_stage_contribution_corrections_reason_not_blank check (length(btrim(reason)) >= 3)
);

create index item_stage_contribution_corrections_tenant_stage_idx
on item_stage_contribution_corrections(tenant_id, stage_instance_id, created_at desc);
alter table item_stage_contribution_corrections enable row level security;
create trigger item_stage_contribution_corrections_immutable
before update or delete on item_stage_contribution_corrections
for each row execute function prevent_immutable_audit_change();

create table item_stage_contribution_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stage_instance_id uuid not null references item_stage_instances(id) on delete cascade,
  operation_type text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  result_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint item_stage_contribution_operations_type check (operation_type in ('start', 'replace', 'complete')),
  unique (tenant_id, idempotency_key)
);

create index item_stage_contribution_operations_tenant_stage_idx
on item_stage_contribution_operations(tenant_id, stage_instance_id, created_at desc);
alter table item_stage_contribution_operations enable row level security;
create trigger item_stage_contribution_operations_immutable
before update or delete on item_stage_contribution_operations
for each row execute function prevent_immutable_audit_change();

comment on table item_type_stage_contribution_rules is
  'Current tenant configuration for analytics-only monetary contribution by item type and internal stage.';
comment on table item_stage_contribution_corrections is
  'Immutable before/after audit history for worker contribution replacement and removal.';
comment on table item_stage_contribution_operations is
  'Immutable idempotency receipts for atomic contribution stage operations.';
comment on column item_stage_work_logs.duration_minutes is
  'Elapsed work-log duration. This remains separate from manually attributed credited_minutes.';
comment on column item_stage_work_logs.credited_minutes is
  'Manually attributed worker effort in ten-minute increments; summed effort can exceed stage elapsed time.';
comment on column item_stage_work_logs.calculated_contribution_amount is
  'Analytics-only contribution value. It does not affect salary, order totals, GST, payments, expenses, or ledgers.';

create or replace function update_stage_configuration_with_effort(
  p_tenant_id uuid,
  p_stage_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_effort_tracking_mode stage_effort_tracking_mode,
  p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform update_stage_configuration(
    p_tenant_id, p_stage_id, p_name, p_description, p_is_active, p_actor_id
  );

  if exists (
    select 1
    from item_type_stage_contribution_rules rule
    where rule.tenant_id = p_tenant_id
      and rule.stage_master_id = p_stage_id
      and rule.is_active = true
      and rule.deleted_at is null
      and (
        (rule.calculation_method = 'per_unit' and p_effort_tracking_mode not in ('units', 'hybrid'))
        or (rule.calculation_method = 'per_hour' and p_effort_tracking_mode not in ('hours', 'hybrid'))
        or (rule.calculation_method = 'percentage' and rule.percentage_allocation_basis = 'units'
          and p_effort_tracking_mode not in ('units', 'hybrid'))
        or (rule.calculation_method = 'percentage' and rule.percentage_allocation_basis = 'hours'
          and p_effort_tracking_mode not in ('hours', 'hybrid'))
      )
  ) then
    raise exception 'STAGE_EFFORT_MODE_HAS_INCOMPATIBLE_RULES' using errcode = 'P0001';
  end if;
  update stage_master
  set effort_tracking_mode = p_effort_tracking_mode, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_stage_id and deleted_at is null;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  return p_stage_id;
end;
$$;

revoke all on function update_stage_configuration_with_effort(uuid, uuid, text, text, boolean, stage_effort_tracking_mode, text) from public, anon, authenticated;
grant execute on function update_stage_configuration_with_effort(uuid, uuid, text, text, boolean, stage_effort_tracking_mode, text) to service_role;

create or replace function upsert_item_type_stage_contribution_rule(
  p_tenant_id uuid,
  p_item_type_id uuid,
  p_stage_id uuid,
  p_calculation_method item_stage_contribution_method,
  p_rate_value numeric,
  p_percentage_allocation_basis contribution_allocation_basis,
  p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mode stage_effort_tracking_mode;
  v_rule_id uuid;
begin
  perform 1 from item_types
  where tenant_id = p_tenant_id and id = p_item_type_id and is_active = true and deleted_at is null
  for share;
  if not found then raise exception 'ITEM_TYPE_NOT_FOUND' using errcode = 'P0001'; end if;

  select effort_tracking_mode into v_mode from stage_master
  where tenant_id = p_tenant_id and id = p_stage_id and is_active = true and deleted_at is null
  for share;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;

  if p_calculation_method is null then
    update item_type_stage_contribution_rules
    set is_active = false, deleted_at = now(), updated_by = p_actor_id
    where tenant_id = p_tenant_id and item_type_id = p_item_type_id
      and stage_master_id = p_stage_id and deleted_at is null;
    return null;
  end if;

  if p_rate_value is null or p_rate_value <= 0
     or (p_calculation_method = 'percentage' and p_rate_value > 100) then
    raise exception 'INVALID_CONTRIBUTION_RATE' using errcode = 'P0001';
  end if;
  if p_calculation_method = 'per_unit' and v_mode not in ('units', 'hybrid') then
    raise exception 'RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE' using errcode = 'P0001';
  end if;
  if p_calculation_method = 'per_hour' and v_mode not in ('hours', 'hybrid') then
    raise exception 'RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE' using errcode = 'P0001';
  end if;
  if p_calculation_method = 'percentage' and (
    (p_percentage_allocation_basis = 'units' and v_mode not in ('units', 'hybrid'))
    or (p_percentage_allocation_basis = 'hours' and v_mode not in ('hours', 'hybrid'))
    or p_percentage_allocation_basis is null
  ) then
    raise exception 'RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE' using errcode = 'P0001';
  end if;

  update item_type_stage_contribution_rules
  set calculation_method = p_calculation_method,
      rate_value = round(p_rate_value, 4),
      percentage_allocation_basis = case
        when p_calculation_method = 'per_unit' then 'units'::contribution_allocation_basis
        when p_calculation_method = 'per_hour' then 'hours'::contribution_allocation_basis
        else p_percentage_allocation_basis
      end,
      is_active = true,
      updated_by = p_actor_id
  where tenant_id = p_tenant_id and item_type_id = p_item_type_id
    and stage_master_id = p_stage_id and deleted_at is null
  returning id into v_rule_id;

  if v_rule_id is null then
    insert into item_type_stage_contribution_rules (
      tenant_id, item_type_id, stage_master_id, calculation_method, rate_value,
      percentage_allocation_basis, is_active, created_by, updated_by
    ) values (
      p_tenant_id, p_item_type_id, p_stage_id, p_calculation_method, round(p_rate_value, 4),
      case
        when p_calculation_method = 'per_unit' then 'units'::contribution_allocation_basis
        when p_calculation_method = 'per_hour' then 'hours'::contribution_allocation_basis
        else p_percentage_allocation_basis
      end,
      true, p_actor_id, p_actor_id
    ) returning id into v_rule_id;
  end if;
  return v_rule_id;
end;
$$;

revoke all on function upsert_item_type_stage_contribution_rule(uuid, uuid, uuid, item_stage_contribution_method, numeric, contribution_allocation_basis, text) from public, anon, authenticated;
grant execute on function upsert_item_type_stage_contribution_rule(uuid, uuid, uuid, item_stage_contribution_method, numeric, contribution_allocation_basis, text) to service_role;

create or replace function recalculate_item_stage_contributions(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_actor_id text
)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_stage item_stage_instances%rowtype;
  v_total numeric(12, 2) := 0;
  v_total_weight numeric := 0;
begin
  select * into v_stage from item_stage_instances
  where tenant_id = p_tenant_id and id = p_stage_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;

  if v_stage.contribution_method_snapshot is null then
    update item_stage_work_logs
    set calculated_contribution_amount = 0, updated_by = p_actor_id
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;
    return 0;
  end if;

  if v_stage.contribution_method_snapshot = 'per_unit' then
    update item_stage_work_logs
    set calculated_contribution_amount = round(credited_units * v_stage.contribution_rate_snapshot, 2),
        updated_by = p_actor_id
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;
  elsif v_stage.contribution_method_snapshot = 'per_hour' then
    update item_stage_work_logs
    set calculated_contribution_amount = round((credited_minutes::numeric / 60) * v_stage.contribution_rate_snapshot, 2),
        updated_by = p_actor_id
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;
  else
    select coalesce(sum(case
      when v_stage.contribution_allocation_basis_snapshot = 'units' then credited_units
      else credited_minutes::numeric
    end), 0)
    into v_total_weight
    from item_stage_work_logs
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

    update item_stage_work_logs
    set calculated_contribution_amount = 0, updated_by = p_actor_id
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

    if v_total_weight > 0 then
      with weighted as (
        select id, worker_id, workgroup_id,
          case when v_stage.contribution_allocation_basis_snapshot = 'units'
            then credited_units else credited_minutes::numeric end as weight,
          floor(
            (coalesce(v_stage.contribution_pool_snapshot, 0) * 100)
            * (case when v_stage.contribution_allocation_basis_snapshot = 'units'
                then credited_units else credited_minutes::numeric end)
            / v_total_weight
          )::integer as floor_paise,
          (
            (coalesce(v_stage.contribution_pool_snapshot, 0) * 100)
            * (case when v_stage.contribution_allocation_basis_snapshot = 'units'
                then credited_units else credited_minutes::numeric end)
            / v_total_weight
          ) - floor(
            (coalesce(v_stage.contribution_pool_snapshot, 0) * 100)
            * (case when v_stage.contribution_allocation_basis_snapshot = 'units'
                then credited_units else credited_minutes::numeric end)
            / v_total_weight
          ) as fractional_remainder
        from item_stage_work_logs
        where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id
          and deleted_at is null
          and case when v_stage.contribution_allocation_basis_snapshot = 'units'
            then credited_units else credited_minutes::numeric end > 0
      ), ranked as (
        select weighted.*,
          row_number() over (order by fractional_remainder desc, worker_id, workgroup_id) as remainder_rank,
          sum(floor_paise) over () as allocated_floor_paise
        from weighted
      )
      update item_stage_work_logs logs
      set calculated_contribution_amount = (
            ranked.floor_paise
            + case when ranked.remainder_rank <= (
                round(coalesce(v_stage.contribution_pool_snapshot, 0) * 100)::integer
                - ranked.allocated_floor_paise
              ) then 1 else 0 end
          )::numeric / 100,
          updated_by = p_actor_id
      from ranked
      where logs.tenant_id = p_tenant_id and logs.id = ranked.id;
    end if;
  end if;

  select round(coalesce(sum(calculated_contribution_amount), 0), 2) into v_total
  from item_stage_work_logs
  where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;
  return v_total;
end;
$$;

revoke all on function recalculate_item_stage_contributions(uuid, uuid, text) from public, anon, authenticated;

create or replace function apply_item_stage_contributions(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_assignments jsonb,
  p_actor_id text,
  p_correction_reason text,
  p_require_completion boolean,
  p_initial_assignment boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stage item_stage_instances%rowtype;
  v_item order_items%rowtype;
  v_assignment jsonb;
  v_worker_id uuid;
  v_workgroup_id uuid;
  v_units numeric(12, 2);
  v_minutes integer;
  v_existing_log_id uuid;
  v_total_units numeric(12, 2) := 0;
  v_total_minutes integer := 0;
  v_total_amount numeric(12, 2) := 0;
  v_assignment_count integer;
  v_old_json jsonb;
  v_new_json jsonb;
  v_old_effort_json jsonb;
  v_new_effort_json jsonb;
  v_status item_stage_work_log_status;
  v_completed_at timestamptz;
begin
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then
    raise exception 'AT_LEAST_ONE_WORKER_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_stage from item_stage_instances
  where tenant_id = p_tenant_id and id = p_stage_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_item from order_items
  where tenant_id = p_tenant_id and id = v_stage.order_item_id and deleted_at is null
  for update;
  if not found then raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = 'P0001'; end if;

  v_assignment_count := jsonb_array_length(p_assignments);
  if v_assignment_count > 1 and exists (
    select 1 from workflow_stages
    where tenant_id = p_tenant_id and id = v_stage.workflow_stage_id
      and allows_multiple_workers = false and deleted_at is null
  ) then raise exception 'MULTIPLE_WORKERS_NOT_ALLOWED' using errcode = 'P0001'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) selected
    group by selected->>'worker_id', selected->>'workgroup_id'
    having count(*) > 1
  ) then raise exception 'DUPLICATE_WORKER_ROLE' using errcode = 'P0001'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'worker_id', worker_id, 'workgroup_id', workgroup_id,
    'credited_units', credited_units, 'credited_minutes', credited_minutes,
    'calculated_contribution_amount', calculated_contribution_amount, 'status', status
  ) order by created_at, id), '[]'::jsonb)
  into v_old_json
  from item_stage_work_logs
  where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'worker_id', worker_id, 'workgroup_id', workgroup_id,
    'credited_units', credited_units, 'credited_minutes', credited_minutes,
    'calculated_contribution_amount', calculated_contribution_amount
  ) order by worker_id, workgroup_id), '[]'::jsonb)
  into v_old_effort_json
  from item_stage_work_logs
  where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

  for v_assignment in select value from jsonb_array_elements(p_assignments)
  loop
    begin
      v_worker_id := (v_assignment->>'worker_id')::uuid;
      v_workgroup_id := (v_assignment->>'workgroup_id')::uuid;
      v_units := round(coalesce((v_assignment->>'credited_units')::numeric, 0), 2);
      v_minutes := coalesce((v_assignment->>'credited_minutes')::integer, 0);
    exception when others then
      raise exception 'INVALID_CONTRIBUTION_ASSIGNMENT' using errcode = 'P0001';
    end;

    select id into v_existing_log_id from item_stage_work_logs
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id
      and worker_id = v_worker_id and workgroup_id = v_workgroup_id and deleted_at is null
    order by created_at desc limit 1;

    if not exists (
      select 1 from workers
      where tenant_id = p_tenant_id and id = v_worker_id and status = 'active' and deleted_at is null
    ) then raise exception 'WORKER_NOT_ELIGIBLE_FOR_STAGE' using errcode = 'P0001'; end if;

    if not exists (
      select 1 from workgroups selected_group
      join stage_workgroups stage_group on stage_group.workgroup_id = selected_group.id
        and stage_group.tenant_id = p_tenant_id and stage_group.stage_master_id = v_stage.stage_master_id
      join worker_workgroups worker_group on worker_group.workgroup_id = selected_group.id
        and worker_group.tenant_id = p_tenant_id and worker_group.worker_id = v_worker_id
      where selected_group.tenant_id = p_tenant_id and selected_group.id = v_workgroup_id
        and selected_group.is_active = true and selected_group.deleted_at is null
    ) then raise exception 'WORKGROUP_NOT_ELIGIBLE_FOR_STAGE' using errcode = 'P0001'; end if;

    if v_stage.effort_tracking_mode_snapshot in ('units', 'hybrid') then
      if v_units < 0 or mod(v_units * 100, 10) <> 0 then
        raise exception 'INVALID_CREDITED_UNIT_INCREMENT' using errcode = 'P0001';
      end if;
    else
      v_units := 0;
    end if;
    if v_stage.effort_tracking_mode_snapshot in ('hours', 'hybrid') then
      if v_minutes < 0 or mod(v_minutes, 10) <> 0 then
        raise exception 'INVALID_CREDITED_MINUTE_INCREMENT' using errcode = 'P0001';
      end if;
    else
      v_minutes := 0;
    end if;
    if p_require_completion and v_stage.effort_tracking_mode_snapshot in ('units', 'hybrid') and v_units <= 0 then
      raise exception 'UNIT_CREDIT_REQUIRED_FOR_EVERY_WORKER' using errcode = 'P0001';
    end if;
    if p_require_completion and v_stage.effort_tracking_mode_snapshot in ('hours', 'hybrid') and v_minutes <= 0 then
      raise exception 'TIME_CREDIT_REQUIRED_FOR_EVERY_WORKER' using errcode = 'P0001';
    end if;
    v_total_units := v_total_units + v_units;
    v_total_minutes := v_total_minutes + v_minutes;
  end loop;

  if v_stage.effort_tracking_mode_snapshot in ('units', 'hybrid') and v_total_units > v_item.quantity then
    raise exception 'UNIT_TOTAL_EXCEEDS_ITEM_QUANTITY' using errcode = 'P0001';
  end if;
  if p_require_completion and v_stage.effort_tracking_mode_snapshot in ('units', 'hybrid')
     and v_total_units <> v_item.quantity then
    raise exception 'UNIT_TOTAL_MUST_EQUAL_ITEM_QUANTITY' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from item_stage_work_logs existing
    where existing.tenant_id = p_tenant_id
      and existing.stage_instance_id = p_stage_instance_id
      and existing.deleted_at is null
      and (existing.credited_units > 0 or existing.credited_minutes > 0)
      and not exists (
        select 1 from jsonb_array_elements(p_assignments) selected
        where selected->>'worker_id' = existing.worker_id::text
          and selected->>'workgroup_id' = existing.workgroup_id::text
      )
  ) and (p_correction_reason is null or length(btrim(p_correction_reason)) < 3) then
    raise exception 'EFFORT_REMOVAL_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update item_stage_work_logs existing
  set status = 'cancelled', deleted_at = now(), updated_by = p_actor_id,
      notes = case when p_correction_reason is null then existing.notes
        else concat_ws(E'\n', existing.notes, 'Removed: ' || btrim(p_correction_reason)) end
  where existing.tenant_id = p_tenant_id and existing.stage_instance_id = p_stage_instance_id
    and existing.deleted_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_assignments) selected
      where selected->>'worker_id' = existing.worker_id::text
        and selected->>'workgroup_id' = existing.workgroup_id::text
    );

  v_status := case when p_require_completion then 'completed'::item_stage_work_log_status
    else 'in_progress'::item_stage_work_log_status end;
  v_completed_at := case when p_require_completion then coalesce(v_stage.completed_at, now()) else null end;

  for v_assignment in select value from jsonb_array_elements(p_assignments)
  loop
    v_worker_id := (v_assignment->>'worker_id')::uuid;
    v_workgroup_id := (v_assignment->>'workgroup_id')::uuid;
    v_units := case when v_stage.effort_tracking_mode_snapshot in ('units', 'hybrid')
      then round(coalesce((v_assignment->>'credited_units')::numeric, 0), 2) else 0 end;
    v_minutes := case when v_stage.effort_tracking_mode_snapshot in ('hours', 'hybrid')
      then coalesce((v_assignment->>'credited_minutes')::integer, 0) else 0 end;
    select id into v_existing_log_id from item_stage_work_logs
    where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id
      and worker_id = v_worker_id and workgroup_id = v_workgroup_id and deleted_at is null
    order by created_at desc limit 1;
    if v_existing_log_id is null then
      insert into item_stage_work_logs (
        tenant_id, stage_instance_id, order_item_id, worker_id, workgroup_id,
        started_at, completed_at, duration_minutes, credited_units, credited_minutes,
        calculated_contribution_amount, status, created_by, updated_by
      ) values (
        p_tenant_id, p_stage_instance_id, v_stage.order_item_id, v_worker_id, v_workgroup_id,
        coalesce(v_stage.started_at, now()), v_completed_at,
        case when p_require_completion then greatest(round(extract(epoch from (v_completed_at - coalesce(v_stage.started_at, v_completed_at))) / 60), 0)::integer else null end,
        v_units, v_minutes, 0, v_status, p_actor_id, p_actor_id
      );
    else
      update item_stage_work_logs
      set credited_units = v_units, credited_minutes = v_minutes, status = v_status,
          completed_at = v_completed_at,
          duration_minutes = case when p_require_completion and v_stage.status <> 'completed'
            then greatest(round(extract(epoch from (v_completed_at - started_at)) / 60), 0)::integer
            else duration_minutes end,
          updated_by = p_actor_id
      where tenant_id = p_tenant_id and id = v_existing_log_id;
    end if;
  end loop;

  v_total_amount := recalculate_item_stage_contributions(p_tenant_id, p_stage_instance_id, p_actor_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'worker_id', worker_id, 'workgroup_id', workgroup_id,
    'credited_units', credited_units, 'credited_minutes', credited_minutes,
    'calculated_contribution_amount', calculated_contribution_amount, 'status', status
  ) order by created_at, id), '[]'::jsonb)
  into v_new_json
  from item_stage_work_logs
  where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'worker_id', worker_id, 'workgroup_id', workgroup_id,
    'credited_units', credited_units, 'credited_minutes', credited_minutes,
    'calculated_contribution_amount', calculated_contribution_amount
  ) order by worker_id, workgroup_id), '[]'::jsonb)
  into v_new_effort_json
  from item_stage_work_logs
  where tenant_id = p_tenant_id and stage_instance_id = p_stage_instance_id and deleted_at is null;

  if not p_initial_assignment and v_old_effort_json is distinct from v_new_effort_json then
    insert into item_stage_contribution_corrections (
      tenant_id, stage_instance_id, order_item_id, reason,
      old_value_json, new_value_json, created_by
    ) values (
      p_tenant_id, p_stage_instance_id, v_stage.order_item_id,
      coalesce(nullif(btrim(p_correction_reason), ''), 'Contribution updated before stage completion.'),
      v_old_json, v_new_json, p_actor_id
    );
  end if;

  update item_stage_instances
  set contribution_revision = contribution_revision + 1,
      updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_stage_instance_id;

  return jsonb_build_object(
    'stage_instance_id', p_stage_instance_id,
    'order_item_id', v_stage.order_item_id,
    'assignment_count', v_assignment_count,
    'credited_units', v_total_units,
    'credited_minutes', v_total_minutes,
    'contribution_amount', v_total_amount,
    'rate_configured', v_stage.contribution_method_snapshot is not null
  );
end;
$$;

revoke all on function apply_item_stage_contributions(uuid, uuid, jsonb, text, text, boolean, boolean) from public, anon, authenticated;

create or replace function start_item_stage_with_contributions(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_assignments jsonb,
  p_notes text,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stage item_stage_instances%rowtype;
  v_item order_items%rowtype;
  v_rule item_type_stage_contribution_rules%rowtype;
  v_mode stage_effort_tracking_mode;
  v_request_fingerprint text;
  v_existing_operation item_stage_contribution_operations%rowtype;
  v_result jsonb;
begin
  v_request_fingerprint := md5(concat_ws('|', p_stage_instance_id::text, p_assignments::text, coalesce(p_notes, '')));
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_idempotency_key::text, 0));
  select * into v_existing_operation from item_stage_contribution_operations
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_operation.operation_type <> 'start'
       or v_existing_operation.stage_instance_id <> p_stage_instance_id
       or v_existing_operation.request_fingerprint <> v_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH' using errcode = 'P0001';
    end if;
    return v_existing_operation.result_json || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into v_stage from item_stage_instances
  where tenant_id = p_tenant_id and id = p_stage_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_stage.status <> 'ready_to_start' then raise exception 'STAGE_NOT_READY' using errcode = 'P0001'; end if;
  perform 1 from item_workflow_instances
  where tenant_id = p_tenant_id and id = v_stage.workflow_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'WORKFLOW_INSTANCE_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_item from order_items
  where tenant_id = p_tenant_id and id = v_stage.order_item_id and deleted_at is null
  for update;
  if not found then raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = 'P0001'; end if;
  select effort_tracking_mode into v_mode from stage_master
  where tenant_id = p_tenant_id and id = v_stage.stage_master_id and is_active = true and deleted_at is null;
  if not found then raise exception 'STAGE_CONFIGURATION_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_rule from item_type_stage_contribution_rules
  where tenant_id = p_tenant_id and item_type_id = v_item.item_type_id
    and stage_master_id = v_stage.stage_master_id and is_active = true and deleted_at is null;

  if v_rule.id is not null and (
    (v_rule.calculation_method = 'per_unit' and v_mode not in ('units', 'hybrid'))
    or (v_rule.calculation_method = 'per_hour' and v_mode not in ('hours', 'hybrid'))
    or (v_rule.calculation_method = 'percentage' and v_rule.percentage_allocation_basis = 'units'
      and v_mode not in ('units', 'hybrid'))
    or (v_rule.calculation_method = 'percentage' and v_rule.percentage_allocation_basis = 'hours'
      and v_mode not in ('hours', 'hybrid'))
  ) then
    raise exception 'RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE' using errcode = 'P0001';
  end if;

  update item_stage_instances
  set effort_tracking_mode_snapshot = v_mode,
      contribution_rule_id_snapshot = v_rule.id,
      contribution_method_snapshot = v_rule.calculation_method,
      contribution_rate_snapshot = v_rule.rate_value,
      contribution_allocation_basis_snapshot = v_rule.percentage_allocation_basis,
      contribution_item_value_snapshot = round(v_item.final_price, 2),
      contribution_pool_snapshot = case when v_rule.calculation_method = 'percentage'
        then round((v_item.final_price * v_rule.rate_value) / 100, 2) else null end,
      status = 'in_progress', started_at = now(), notes = nullif(btrim(p_notes), ''),
      updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_stage_instance_id;

  update item_workflow_instances
  set status = 'in_progress', started_at = coalesce(started_at, now()),
      current_stage_instance_id = p_stage_instance_id, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_stage.workflow_instance_id;
  update order_items
  set item_status = 'in_production', customer_status_id = v_stage.customer_status_id,
      updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_stage.order_item_id;

  v_result := apply_item_stage_contributions(
    p_tenant_id, p_stage_instance_id, p_assignments, p_actor_id, null, false, true
  );
  insert into item_history (
    tenant_id, order_item_id, event_type, new_value_json, notes, created_by
  ) values (
    p_tenant_id, v_stage.order_item_id, 'stage_started',
    jsonb_build_object('stage_instance_id', p_stage_instance_id, 'contributions', v_result),
    nullif(btrim(p_notes), ''), p_actor_id
  );
  update orders set order_status = 'in_progress', updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_item.order_id
    and order_status not in ('cancelled', 'delivered');
  v_result := v_result || jsonb_build_object('idempotent_replay', false);
  insert into item_stage_contribution_operations (
    tenant_id, stage_instance_id, operation_type, idempotency_key,
    request_fingerprint, result_json, created_by
  ) values (
    p_tenant_id, p_stage_instance_id, 'start', p_idempotency_key,
    v_request_fingerprint, v_result, p_actor_id
  );
  return v_result;
end;
$$;

revoke all on function start_item_stage_with_contributions(uuid, uuid, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function start_item_stage_with_contributions(uuid, uuid, jsonb, text, text, uuid) to service_role;

create or replace function replace_item_stage_contributions(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_assignments jsonb,
  p_correction_reason text,
  p_actor_id text,
  p_allow_completed boolean,
  p_expected_revision bigint,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stage item_stage_instances%rowtype;
  v_request_fingerprint text;
  v_existing_operation item_stage_contribution_operations%rowtype;
  v_result jsonb;
begin
  v_request_fingerprint := md5(concat_ws('|', p_stage_instance_id::text, p_assignments::text, coalesce(p_correction_reason, ''), p_allow_completed::text, p_expected_revision::text));
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_idempotency_key::text, 0));
  select * into v_existing_operation from item_stage_contribution_operations
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_operation.operation_type <> 'replace'
       or v_existing_operation.stage_instance_id <> p_stage_instance_id
       or v_existing_operation.request_fingerprint <> v_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH' using errcode = 'P0001';
    end if;
    return v_existing_operation.result_json || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into v_stage from item_stage_instances
  where tenant_id = p_tenant_id and id = p_stage_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_stage.status not in ('in_progress', 'completed') then
    raise exception 'STAGE_CONTRIBUTIONS_NOT_EDITABLE' using errcode = 'P0001';
  end if;
  if v_stage.status = 'completed' and v_stage.effort_tracking_mode_snapshot is null then
    raise exception 'LEGACY_COMPLETED_STAGE_IMMUTABLE' using errcode = 'P0001';
  end if;
  if v_stage.contribution_revision <> p_expected_revision then
    raise exception 'STALE_CONTRIBUTION_REVISION' using errcode = 'P0001';
  end if;
  if v_stage.status = 'completed' and not p_allow_completed then
    raise exception 'COMPLETED_CONTRIBUTION_CORRECTION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_stage.status = 'completed' and (p_correction_reason is null or length(btrim(p_correction_reason)) < 3) then
    raise exception 'CORRECTION_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  v_result := apply_item_stage_contributions(
    p_tenant_id, p_stage_instance_id, p_assignments, p_actor_id,
    p_correction_reason, v_stage.status = 'completed', false
  );
  insert into item_history (
    tenant_id, order_item_id, event_type, new_value_json, notes, created_by
  ) values (
    p_tenant_id, v_stage.order_item_id,
    case when v_stage.status = 'completed' then 'stage_contributions_corrected' else 'stage_contributions_updated' end,
    jsonb_build_object('stage_instance_id', p_stage_instance_id, 'contributions', v_result),
    nullif(btrim(p_correction_reason), ''), p_actor_id
  );
  v_result := v_result || jsonb_build_object('idempotent_replay', false);
  insert into item_stage_contribution_operations (
    tenant_id, stage_instance_id, operation_type, idempotency_key,
    request_fingerprint, result_json, created_by
  ) values (
    p_tenant_id, p_stage_instance_id, 'replace', p_idempotency_key,
    v_request_fingerprint, v_result, p_actor_id
  );
  return v_result;
end;
$$;

revoke all on function replace_item_stage_contributions(uuid, uuid, jsonb, text, text, boolean, bigint, uuid) from public, anon, authenticated;
grant execute on function replace_item_stage_contributions(uuid, uuid, jsonb, text, text, boolean, bigint, uuid) to service_role;

create or replace function complete_item_stage_with_contributions(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_assignments jsonb,
  p_notes text,
  p_correction_reason text,
  p_actor_id text,
  p_expected_revision bigint,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stage item_stage_instances%rowtype;
  v_item order_items%rowtype;
  v_next_stage item_stage_instances%rowtype;
  v_request_fingerprint text;
  v_existing_operation item_stage_contribution_operations%rowtype;
  v_result jsonb;
  v_item_status item_status;
  v_order_status order_status;
begin
  v_request_fingerprint := md5(concat_ws('|', p_stage_instance_id::text, p_assignments::text, coalesce(p_notes, ''), coalesce(p_correction_reason, ''), p_expected_revision::text));
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_idempotency_key::text, 0));
  select * into v_existing_operation from item_stage_contribution_operations
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_operation.operation_type <> 'complete'
       or v_existing_operation.stage_instance_id <> p_stage_instance_id
       or v_existing_operation.request_fingerprint <> v_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH' using errcode = 'P0001';
    end if;
    return v_existing_operation.result_json || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into v_stage from item_stage_instances
  where tenant_id = p_tenant_id and id = p_stage_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_stage.status <> 'in_progress' then raise exception 'STAGE_NOT_IN_PROGRESS' using errcode = 'P0001'; end if;
  if v_stage.contribution_revision <> p_expected_revision then
    raise exception 'STALE_CONTRIBUTION_REVISION' using errcode = 'P0001';
  end if;
  perform 1 from item_workflow_instances
  where tenant_id = p_tenant_id and id = v_stage.workflow_instance_id and deleted_at is null
  for update;
  if not found then raise exception 'WORKFLOW_INSTANCE_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_item from order_items
  where tenant_id = p_tenant_id and id = v_stage.order_item_id and deleted_at is null
  for update;
  if not found then raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = 'P0001'; end if;

  v_result := apply_item_stage_contributions(
    p_tenant_id, p_stage_instance_id, p_assignments, p_actor_id,
    p_correction_reason, true, false
  );
  update item_stage_instances
  set status = 'completed', completed_at = now(),
      notes = coalesce(nullif(btrim(p_notes), ''), notes), updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_stage_instance_id;

  select * into v_next_stage from item_stage_instances
  where tenant_id = p_tenant_id and workflow_instance_id = v_stage.workflow_instance_id
    and sequence_number > v_stage.sequence_number and deleted_at is null
  order by sequence_number limit 1
  for update;

  if v_next_stage.id is not null then
    update item_stage_instances set status = 'ready_to_start', updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = v_next_stage.id;
    update item_workflow_instances
    set current_stage_instance_id = v_next_stage.id, updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = v_stage.workflow_instance_id;
    update order_items
    set customer_status_id = v_next_stage.customer_status_id, updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = v_stage.order_item_id;
  else
    select case when coalesce(customer_statuses.is_final_status, false)
      then 'delivered'::item_status else 'completed'::item_status end
    into v_item_status
    from stage_master
    left join customer_statuses on customer_statuses.id = v_stage.customer_status_id
      and customer_statuses.tenant_id = p_tenant_id and customer_statuses.deleted_at is null
    where stage_master.tenant_id = p_tenant_id and stage_master.id = v_stage.stage_master_id;
    v_item_status := coalesce(v_item_status, 'completed'::item_status);
    update item_workflow_instances
    set status = 'completed', completed_at = now(), current_stage_instance_id = null,
        updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = v_stage.workflow_instance_id;
    update order_items
    set item_status = v_item_status, customer_status_id = v_stage.customer_status_id,
        updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = v_stage.order_item_id;
  end if;

  select case
    when bool_and(item_status = 'delivered') then 'delivered'::order_status
    when bool_or(item_status = 'delivered') then 'partially_delivered'::order_status
    when bool_or(item_status <> 'not_started') then 'in_progress'::order_status
    else 'confirmed'::order_status end
  into v_order_status
  from order_items
  where tenant_id = p_tenant_id and order_id = v_item.order_id and deleted_at is null;
  update orders set order_status = coalesce(v_order_status, 'confirmed'::order_status), updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_item.order_id and order_status <> 'cancelled';

  insert into item_history (
    tenant_id, order_item_id, event_type, new_value_json, notes, created_by
  ) values (
    p_tenant_id, v_stage.order_item_id, 'stage_completed',
    jsonb_build_object(
      'stage_instance_id', p_stage_instance_id,
      'next_stage_instance_id', v_next_stage.id,
      'contributions', v_result
    ), nullif(btrim(p_notes), ''), p_actor_id
  );
  v_result := v_result || jsonb_build_object(
    'next_stage_instance_id', v_next_stage.id,
    'idempotent_replay', false
  );
  insert into item_stage_contribution_operations (
    tenant_id, stage_instance_id, operation_type, idempotency_key,
    request_fingerprint, result_json, created_by
  ) values (
    p_tenant_id, p_stage_instance_id, 'complete', p_idempotency_key,
    v_request_fingerprint, v_result, p_actor_id
  );
  return v_result;
end;
$$;

revoke all on function complete_item_stage_with_contributions(uuid, uuid, jsonb, text, text, text, bigint, uuid) from public, anon, authenticated;
grant execute on function complete_item_stage_with_contributions(uuid, uuid, jsonb, text, text, text, bigint, uuid) to service_role;
