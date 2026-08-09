-- Allow practical 40/60 and 30/30/40 worker splits while preserving a
-- deterministic, tenant-safe reporting path for completed contributions.

alter table item_stage_work_logs
  drop constraint if exists item_stage_work_logs_credited_units_quarter_step,
  drop constraint if exists item_stage_work_logs_credited_units_tenth_step;

alter table item_stage_work_logs
  add constraint item_stage_work_logs_credited_units_tenth_step
  check (mod(credited_units * 100, 10) = 0);

-- The original contribution RPC was applied before the tenth-unit product
-- decision. Replace only its known increment expression and fail closed if the
-- installed function is neither the quarter-step nor the tenth-step version.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'apply_item_stage_contributions(uuid,uuid,jsonb,text,text,boolean,boolean)'::regprocedure
  ) into v_definition;

  if position('mod(v_units * 100, 25) <> 0' in v_definition) > 0 then
    execute replace(
      v_definition,
      'mod(v_units * 100, 25) <> 0',
      'mod(v_units * 100, 10) <> 0'
    );
  elsif position('mod(v_units * 100, 10) <> 0' in v_definition) = 0 then
    raise exception 'UNEXPECTED_STAGE_CONTRIBUTION_INCREMENT_FUNCTION';
  end if;
end
$migration$;

-- The applied base migration also inferred fulfillment from editable labels.
-- Replace that exact known branch with the explicit customer-status final flag.
do $migration$
declare
  v_definition text;
  v_old_branch text := $old$select case when lower(coalesce(stage_master.name, '')) like '%deliver%'
      or lower(coalesce(stage_master.name, '')) like '%handoff%'
      or lower(coalesce(customer_statuses.name, '')) like '%deliver%'
      or lower(coalesce(customer_statuses.name, '')) like '%handoff%'
      then 'delivered'::item_status else 'completed'::item_status end$old$;
  v_new_branch text := $new$select case when coalesce(customer_statuses.is_final_status, false)
      then 'delivered'::item_status else 'completed'::item_status end$new$;
begin
  select pg_get_functiondef(
    'complete_item_stage_with_contributions(uuid,uuid,jsonb,text,text,text,bigint,uuid)'::regprocedure
  ) into v_definition;

  if position(v_old_branch in v_definition) > 0 then
    execute replace(v_definition, v_old_branch, v_new_branch);
  elsif position('customer_statuses.is_final_status' in v_definition) = 0 then
    raise exception 'UNEXPECTED_STAGE_CONTRIBUTION_COMPLETION_FUNCTION';
  end if;
end
$migration$;

-- Largest-remainder allocation works in integer paise. It cannot create a
-- negative last row or over-allocate a tiny percentage pool.
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

-- The applied base function included status in its before/after comparison,
-- so an ordinary in-progress -> completed transition could look like a
-- correction. Keep real effort changes, but suppress status-only audit rows.
create or replace function suppress_status_only_contribution_correction()
returns trigger language plpgsql set search_path = public as $$
declare
  v_old_effort jsonb;
  v_new_effort jsonb;
begin
  select coalesce(jsonb_agg(entry - 'status' order by entry->>'worker_id', entry->>'workgroup_id'), '[]'::jsonb)
  into v_old_effort
  from jsonb_array_elements(new.old_value_json) entry;

  select coalesce(jsonb_agg(entry - 'status' order by entry->>'worker_id', entry->>'workgroup_id'), '[]'::jsonb)
  into v_new_effort
  from jsonb_array_elements(new.new_value_json) entry;

  if v_old_effort = v_new_effort then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists item_stage_contribution_corrections_ignore_status_only
  on item_stage_contribution_corrections;
create trigger item_stage_contribution_corrections_ignore_status_only
before insert on item_stage_contribution_corrections
for each row execute function suppress_status_only_contribution_correction();

create index if not exists item_stage_work_logs_tenant_completed_contribution_idx
  on item_stage_work_logs(tenant_id, completed_at, worker_id)
  where deleted_at is null and status = 'completed';

comment on constraint item_stage_work_logs_credited_units_tenth_step on item_stage_work_logs is
  'Credited production units use one-tenth increments so multi-worker effort can be split 40/60 or 30/30/40.';
