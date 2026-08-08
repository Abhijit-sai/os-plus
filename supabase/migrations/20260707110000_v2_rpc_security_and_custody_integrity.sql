-- V2 command RPCs accept explicit tenant and actor context and are intentionally
-- called only by authenticated server actions through the service-role client.
-- SECURITY DEFINER functions are executable by PUBLIC by default in PostgreSQL,
-- so remove direct PostgREST/browser execution and retain the server boundary.
do $$
declare
  v_function record;
  v_function_names text[] := array[
    'initialize_work_unit_workflow',
    'start_work_unit_stage',
    'complete_work_unit_stage',
    'create_work_unit_runtime',
    'create_task_command',
    'assign_task_command',
    'start_task_command',
    'complete_task_command',
    'cancel_task_command',
    'start_work_unit_stage_command',
    'complete_work_unit_stage_command',
    'assert_laundry_vertical_enabled',
    'generate_laundry_human_code',
    'generate_qr_identity_token',
    'create_laundry_pickup_request_command',
    'create_laundry_container_asset_command',
    'complete_laundry_pickup_request_command',
    'create_laundry_service_lot_command'
  ];
begin
  for v_function in
    select procedure.oid::regprocedure as signature
    from pg_proc as procedure
    inner join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(v_function_names)
  loop
    execute format('revoke all on function %s from public', v_function.signature);
    execute format('revoke all on function %s from anon', v_function.signature);
    execute format('revoke all on function %s from authenticated', v_function.signature);
    execute format('grant execute on function %s to service_role', v_function.signature);
  end loop;
end;
$$;

create or replace function enforce_laundry_container_customer_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_assigned_customer_id uuid;
  v_status text;
begin
  if new.container_asset_id is null then
    return new;
  end if;

  select assigned_customer_id, status
  into v_assigned_customer_id, v_status
  from laundry_container_assets
  where tenant_id = new.tenant_id
    and id = new.container_asset_id
    and deleted_at is null;

  if not found then
    raise exception 'LAUNDRY_CONTAINER_ASSET_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_status <> 'active' then
    raise exception 'LAUNDRY_CONTAINER_ASSET_NOT_ACTIVE'
      using errcode = 'P0001';
  end if;

  if v_assigned_customer_id is not null
     and v_assigned_customer_id <> new.customer_id then
    raise exception 'LAUNDRY_CONTAINER_CUSTOMER_MISMATCH'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from laundry_handling_units as handling_unit
    inner join laundry_container_assets as container_asset
      on container_asset.tenant_id = handling_unit.tenant_id
     and container_asset.id = handling_unit.container_asset_id
    where handling_unit.deleted_at is null
      and container_asset.deleted_at is null
      and container_asset.assigned_customer_id is not null
      and container_asset.assigned_customer_id <> handling_unit.customer_id
  ) then
    raise exception 'EXISTING_LAUNDRY_CONTAINER_CUSTOMER_MISMATCH'
      using errcode = 'P0001';
  end if;
end;
$$;

drop trigger if exists laundry_handling_units_validate_container_assignment
on laundry_handling_units;

create trigger laundry_handling_units_validate_container_assignment
before insert or update of tenant_id, customer_id, container_asset_id
on laundry_handling_units
for each row
execute function enforce_laundry_container_customer_assignment();

revoke all on function enforce_laundry_container_customer_assignment() from public;
revoke all on function enforce_laundry_container_customer_assignment() from anon;
revoke all on function enforce_laundry_container_customer_assignment() from authenticated;

comment on function enforce_laundry_container_customer_assignment()
is 'Prevents an active Laundry container assigned to one customer from being linked to another customer handling unit.';
