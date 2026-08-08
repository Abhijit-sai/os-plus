create or replace function start_work_unit_stage(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_worker_id uuid,
  p_actor text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage work_unit_stage_instances%rowtype;
  v_work_unit work_units%rowtype;
  v_matching_workgroup_id uuid;
  v_log_id uuid;
  v_now timestamptz := now();
begin
  select *
  into v_stage
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and id = p_stage_instance_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORK_UNIT_STAGE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_stage.status <> 'ready_to_start' then
    raise exception 'WORK_UNIT_STAGE_NOT_READY'
      using errcode = 'P0001';
  end if;

  select *
  into v_work_unit
  from work_units
  where tenant_id = p_tenant_id
    and id = v_stage.work_unit_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORK_UNIT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  perform 1
  from workers
  where tenant_id = p_tenant_id
    and id = p_worker_id
    and status = 'active'
    and deleted_at is null;

  if not found then
    raise exception 'WORKER_NOT_FOUND_OR_INACTIVE'
      using errcode = 'P0001';
  end if;

  perform 1
  from stage_workgroups
  where tenant_id = p_tenant_id
    and stage_master_id = v_stage.stage_master_id
  limit 1;

  if not found then
    raise exception 'STAGE_HAS_NO_ALLOWED_WORKGROUPS'
      using errcode = 'P0001';
  end if;

  select worker_workgroups.workgroup_id
  into v_matching_workgroup_id
  from worker_workgroups
  inner join stage_workgroups
    on stage_workgroups.tenant_id = worker_workgroups.tenant_id
   and stage_workgroups.workgroup_id = worker_workgroups.workgroup_id
   and stage_workgroups.stage_master_id = v_stage.stage_master_id
  where worker_workgroups.tenant_id = p_tenant_id
    and worker_workgroups.worker_id = p_worker_id
  limit 1;

  if v_matching_workgroup_id is null then
    raise exception 'WORKER_NOT_ALLOWED_FOR_STAGE'
      using errcode = 'P0001';
  end if;

  update work_unit_stage_instances
  set
    status = 'in_progress',
    started_at = coalesce(started_at, v_now),
    notes = p_notes,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.id;

  update work_unit_workflow_instances
  set
    status = 'in_progress',
    started_at = coalesce(started_at, v_now),
    current_stage_instance_id = v_stage.id,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.workflow_instance_id
    and deleted_at is null;

  update work_units
  set
    status = 'in_progress',
    customer_status_id = v_stage.customer_status_id,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.work_unit_id
    and deleted_at is null;

  insert into work_unit_stage_work_logs (
    tenant_id,
    stage_instance_id,
    work_unit_id,
    worker_id,
    workgroup_id,
    started_at,
    status,
    notes,
    created_by
  )
  values (
    p_tenant_id,
    v_stage.id,
    v_stage.work_unit_id,
    p_worker_id,
    v_matching_workgroup_id,
    v_now,
    'in_progress',
    p_notes,
    p_actor
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

comment on function start_work_unit_stage(uuid, uuid, uuid, text, text)
is 'Atomically starts a V2 Work Unit stage after tenant, state, worker and stage-workgroup validation.';

create or replace function complete_work_unit_stage(
  p_tenant_id uuid,
  p_stage_instance_id uuid,
  p_actor text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage work_unit_stage_instances%rowtype;
  v_next_stage work_unit_stage_instances%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_stage
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and id = p_stage_instance_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORK_UNIT_STAGE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_stage.status <> 'in_progress' then
    raise exception 'WORK_UNIT_STAGE_NOT_IN_PROGRESS'
      using errcode = 'P0001';
  end if;

  update work_unit_stage_work_logs
  set
    status = 'completed',
    completed_at = v_now,
    duration_minutes = greatest(round(extract(epoch from (v_now - started_at)) / 60)::integer, 0)
  where tenant_id = p_tenant_id
    and stage_instance_id = v_stage.id
    and status = 'in_progress'
    and deleted_at is null;

  update work_unit_stage_instances
  set
    status = 'completed',
    completed_at = v_now,
    notes = coalesce(p_notes, notes),
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.id;

  select *
  into v_next_stage
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and workflow_instance_id = v_stage.workflow_instance_id
    and sequence_number > v_stage.sequence_number
    and deleted_at is null
  order by sequence_number
  limit 1
  for update;

  if found then
    update work_unit_stage_instances
    set
      status = 'ready_to_start',
      updated_by = p_actor
    where tenant_id = p_tenant_id
      and id = v_next_stage.id
      and status = 'not_started';

    update work_unit_workflow_instances
    set
      current_stage_instance_id = v_next_stage.id,
      updated_by = p_actor
    where tenant_id = p_tenant_id
      and id = v_stage.workflow_instance_id
      and deleted_at is null;

    update work_units
    set
      status = 'in_progress',
      customer_status_id = v_next_stage.customer_status_id,
      updated_by = p_actor
    where tenant_id = p_tenant_id
      and id = v_stage.work_unit_id
      and deleted_at is null;

    return v_next_stage.id;
  end if;

  update work_unit_workflow_instances
  set
    status = 'completed',
    completed_at = v_now,
    current_stage_instance_id = null,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.workflow_instance_id
    and deleted_at is null;

  update work_units
  set
    status = 'production_complete',
    customer_status_id = v_stage.customer_status_id,
    production_completed_at = v_now,
    updated_by = p_actor
  where tenant_id = p_tenant_id
    and id = v_stage.work_unit_id
    and deleted_at is null;

  return null;
end;
$$;

comment on function complete_work_unit_stage(uuid, uuid, text, text)
is 'Atomically completes a V2 Work Unit stage, prepares the next configured stage, or marks production complete without inferring fulfilment.';
