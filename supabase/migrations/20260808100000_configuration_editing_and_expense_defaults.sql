create or replace function update_worker_configuration(
  p_tenant_id uuid,
  p_worker_id uuid,
  p_name text,
  p_phone text,
  p_joining_date date,
  p_status worker_status,
  p_primary_workgroup_id uuid,
  p_wage_type worker_wage_type,
  p_wage_amount numeric,
  p_notes text,
  p_workgroup_ids uuid[],
  p_actor_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workgroup_ids uuid[] := coalesce(p_workgroup_ids, '{}'::uuid[]);
begin
  perform 1 from workers
  where tenant_id = p_tenant_id and id = p_worker_id and deleted_at is null
  for update;
  if not found then raise exception 'WORKER_NOT_FOUND' using errcode = 'P0001'; end if;

  if p_wage_amount < 0 then raise exception 'INVALID_WAGE_AMOUNT' using errcode = 'P0001'; end if;

  if p_primary_workgroup_id is not null and not (p_primary_workgroup_id = any(v_workgroup_ids)) then
    v_workgroup_ids := array_append(v_workgroup_ids, p_primary_workgroup_id);
  end if;
  select coalesce(array_agg(distinct value), '{}'::uuid[]) into v_workgroup_ids from unnest(v_workgroup_ids) value;

  if exists (
    select 1 from unnest(v_workgroup_ids) selected_id
    where not exists (
      select 1 from workgroups
      where tenant_id = p_tenant_id and id = selected_id and is_active = true and deleted_at is null
    )
  ) then raise exception 'WORKGROUP_NOT_FOUND' using errcode = 'P0001'; end if;

  update workers set
    name = btrim(p_name), phone = nullif(btrim(p_phone), ''), joining_date = p_joining_date,
    status = p_status, primary_workgroup_id = p_primary_workgroup_id,
    wage_type = p_wage_type, wage_amount = p_wage_amount, notes = nullif(btrim(p_notes), ''), updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_worker_id;

  delete from worker_workgroups where tenant_id = p_tenant_id and worker_id = p_worker_id;
  insert into worker_workgroups (tenant_id, worker_id, workgroup_id, created_by)
  select p_tenant_id, p_worker_id, workgroup_id, p_actor_id from unnest(v_workgroup_ids) workgroup_id;
  return p_worker_id;
end;
$$;

revoke all on function update_worker_configuration(uuid, uuid, text, text, date, worker_status, uuid, worker_wage_type, numeric, text, uuid[], text) from public, anon, authenticated;
grant execute on function update_worker_configuration(uuid, uuid, text, text, date, worker_status, uuid, worker_wage_type, numeric, text, uuid[], text) to service_role;

create or replace function seed_default_expense_categories_for_tenant(p_tenant_id uuid, p_actor_id text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_inserted integer;
begin
  insert into expense_categories (tenant_id, name, is_default, is_active, created_by, updated_by)
  select p_tenant_id, default_name, true, true, p_actor_id, p_actor_id
  from unnest(array['Raw material','Salary','Marketing','Rent','Travel','Utilities','Packaging','Courier','Maintenance','Miscellaneous']) default_name
  where not exists (
    select 1 from expense_categories existing
    where existing.tenant_id = p_tenant_id and existing.deleted_at is null and lower(btrim(existing.name)) = lower(default_name)
  );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function seed_default_expense_categories_for_tenant(uuid, text) from public, anon, authenticated;
grant execute on function seed_default_expense_categories_for_tenant(uuid, text) to service_role;

create or replace function seed_default_expense_categories_after_tenant_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform seed_default_expense_categories_for_tenant(new.id, null);
  return new;
end;
$$;

drop trigger if exists tenants_seed_default_expense_categories on tenants;
create trigger tenants_seed_default_expense_categories
after insert on tenants for each row execute function seed_default_expense_categories_after_tenant_insert();

do $$ declare tenant_row record; begin
  for tenant_row in select id from tenants loop
    perform seed_default_expense_categories_for_tenant(tenant_row.id, null);
  end loop;
end $$;

create or replace function update_stage_configuration(
  p_tenant_id uuid, p_stage_id uuid, p_name text, p_description text,
  p_is_active boolean, p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform workflows.id
  from workflows
  join workflow_stages on workflow_stages.workflow_id = workflows.id
    and workflow_stages.tenant_id = p_tenant_id
    and workflow_stages.stage_master_id = p_stage_id
    and workflow_stages.is_active = true
    and workflow_stages.deleted_at is null
  where workflows.tenant_id = p_tenant_id
    and workflows.is_active = true
    and workflows.deleted_at is null
  order by workflows.id
  for update of workflows;

  perform 1 from stage_master
  where tenant_id = p_tenant_id and id = p_stage_id and deleted_at is null
  for update;
  if not found then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;

  if not p_is_active and exists (
    select 1
    from workflows
    join workflow_stages selected_stage on selected_stage.workflow_id = workflows.id
      and selected_stage.tenant_id = p_tenant_id
      and selected_stage.stage_master_id = p_stage_id
      and selected_stage.is_active = true
      and selected_stage.deleted_at is null
    where workflows.tenant_id = p_tenant_id
      and workflows.is_active = true
      and workflows.deleted_at is null
      and not exists (
        select 1
        from workflow_stages alternative_stage
        join stage_master alternative_master on alternative_master.id = alternative_stage.stage_master_id
          and alternative_master.tenant_id = p_tenant_id
          and alternative_master.is_active = true
          and alternative_master.deleted_at is null
        where alternative_stage.tenant_id = p_tenant_id
          and alternative_stage.workflow_id = workflows.id
          and alternative_stage.stage_master_id <> p_stage_id
          and alternative_stage.is_active = true
          and alternative_stage.deleted_at is null
      )
  ) then raise exception 'STAGE_REQUIRED_BY_ACTIVE_WORKFLOW' using errcode = 'P0001'; end if;

  update stage_master set name = btrim(p_name), description = nullif(btrim(p_description), ''),
    is_active = p_is_active, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_stage_id;
  return p_stage_id;
end;
$$;

revoke all on function update_stage_configuration(uuid, uuid, text, text, boolean, text) from public, anon, authenticated;
grant execute on function update_stage_configuration(uuid, uuid, text, text, boolean, text) to service_role;

create or replace function create_workflow_configuration(
  p_tenant_id uuid, p_name text, p_description text, p_item_type_id uuid,
  p_is_default boolean, p_stage_ids uuid[], p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_workflow_id uuid;
begin
  if coalesce(cardinality(p_stage_ids), 0) = 0 then
    raise exception 'WORKFLOW_REQUIRES_STAGE' using errcode = 'P0001';
  end if;
  if (select count(distinct stage_id) from unnest(p_stage_ids) stage_id) <> cardinality(p_stage_ids) then
    raise exception 'DUPLICATE_WORKFLOW_STAGE' using errcode = 'P0001';
  end if;
  if p_is_default and p_item_type_id is null then
    raise exception 'DEFAULT_WORKFLOW_REQUIRES_ITEM_TYPE' using errcode = 'P0001';
  end if;
  if p_item_type_id is not null then
    perform 1 from item_types
    where tenant_id = p_tenant_id and id = p_item_type_id and deleted_at is null
    for update;
    if not found then raise exception 'ITEM_TYPE_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;
  perform id from stage_master
  where tenant_id = p_tenant_id and id = any(p_stage_ids)
    and is_active = true and deleted_at is null
  order by id for share;
  if exists (
    select 1 from unnest(p_stage_ids) selected_id
    where not exists (
      select 1 from stage_master
      where tenant_id = p_tenant_id and id = selected_id and is_active = true and deleted_at is null
    )
  ) then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;

  insert into workflows (
    tenant_id, name, description, item_type_id, is_default, is_active, created_by, updated_by
  ) values (
    p_tenant_id, btrim(p_name), nullif(btrim(p_description), ''), p_item_type_id,
    p_is_default, true, p_actor_id, p_actor_id
  ) returning id into v_workflow_id;

  insert into workflow_stages (
    tenant_id, workflow_id, stage_master_id, sequence_number,
    is_mandatory, allows_multiple_workers, created_by, updated_by
  )
  select p_tenant_id, v_workflow_id, stage_id, sequence_number,
    true, true, p_actor_id, p_actor_id
  from unnest(p_stage_ids) with ordinality selected(stage_id, sequence_number);

  if p_is_default then
    update workflows set is_default = false, updated_by = p_actor_id
    where tenant_id = p_tenant_id and item_type_id = p_item_type_id
      and id <> v_workflow_id and deleted_at is null;
    update item_types set default_workflow_id = v_workflow_id, updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = p_item_type_id;
  end if;
  return v_workflow_id;
end;
$$;

revoke all on function create_workflow_configuration(uuid, text, text, uuid, boolean, uuid[], text) from public, anon, authenticated;
grant execute on function create_workflow_configuration(uuid, text, text, uuid, boolean, uuid[], text) to service_role;

create or replace function replace_workflow_stage_sequence(
  p_tenant_id uuid, p_workflow_id uuid, p_stage_ids uuid[],
  p_customer_status_ids uuid[], p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform 1 from workflows
  where tenant_id = p_tenant_id and id = p_workflow_id and deleted_at is null
  for update;
  if not found then raise exception 'WORKFLOW_NOT_FOUND' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_stage_ids), 0) = 0 then
    raise exception 'WORKFLOW_REQUIRES_STAGE' using errcode = 'P0001';
  end if;
  if cardinality(p_stage_ids) <> coalesce(cardinality(p_customer_status_ids), 0) then
    raise exception 'WORKFLOW_STAGE_STATUS_LENGTH_MISMATCH' using errcode = 'P0001';
  end if;
  if (select count(distinct stage_id) from unnest(p_stage_ids) stage_id) <> cardinality(p_stage_ids) then
    raise exception 'DUPLICATE_WORKFLOW_STAGE' using errcode = 'P0001';
  end if;
  perform id from stage_master
  where tenant_id = p_tenant_id and id = any(p_stage_ids)
    and is_active = true and deleted_at is null
  order by id for share;
  if exists (
    select 1 from unnest(p_stage_ids) selected_id
    where not exists (
      select 1 from stage_master
      where tenant_id = p_tenant_id and id = selected_id and is_active = true and deleted_at is null
    )
  ) then raise exception 'STAGE_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists (
    select 1 from unnest(p_customer_status_ids) selected_id
    where selected_id is not null and not exists (
      select 1 from customer_statuses
      where tenant_id = p_tenant_id and id = selected_id and deleted_at is null
    )
  ) then raise exception 'CUSTOMER_STATUS_NOT_FOUND' using errcode = 'P0001'; end if;

  update workflow_stages set deleted_at = now(), updated_by = p_actor_id
  where tenant_id = p_tenant_id and workflow_id = p_workflow_id and deleted_at is null;
  insert into workflow_stages (
    tenant_id, workflow_id, stage_master_id, sequence_number, is_mandatory,
    allows_multiple_workers, customer_status_id, created_by, updated_by
  )
  select p_tenant_id, p_workflow_id, stages.stage_id, stages.sequence_number,
    true, true, statuses.customer_status_id, p_actor_id, p_actor_id
  from unnest(p_stage_ids) with ordinality stages(stage_id, sequence_number)
  join unnest(p_customer_status_ids) with ordinality statuses(customer_status_id, sequence_number)
    using (sequence_number);
  return p_workflow_id;
end;
$$;

revoke all on function replace_workflow_stage_sequence(uuid, uuid, uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function replace_workflow_stage_sequence(uuid, uuid, uuid[], uuid[], text) to service_role;

create or replace function update_workflow_configuration(
  p_tenant_id uuid, p_workflow_id uuid, p_name text, p_description text,
  p_item_type_id uuid, p_is_default boolean, p_is_active boolean, p_actor_id text
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform 1 from workflows where tenant_id = p_tenant_id and id = p_workflow_id and deleted_at is null for update;
  if not found then raise exception 'WORKFLOW_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_item_type_id is not null then
    perform 1 from item_types
    where tenant_id = p_tenant_id and id = p_item_type_id and deleted_at is null
    for update;
    if not found then raise exception 'ITEM_TYPE_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;
  if p_is_default and p_item_type_id is null then raise exception 'DEFAULT_WORKFLOW_REQUIRES_ITEM_TYPE' using errcode = 'P0001'; end if;
  if p_is_default and not p_is_active then raise exception 'DEFAULT_WORKFLOW_MUST_BE_ACTIVE' using errcode = 'P0001'; end if;
  if p_is_active then
    -- Keep the workflow -> stage lock order shared with update_stage_configuration.
    -- The stage share lock makes the activation check stable until commit, so a
    -- concurrent last-stage deactivation must serialize and re-check its guard.
    perform stage_master.id
    from workflow_stages
    join stage_master on stage_master.id = workflow_stages.stage_master_id
      and stage_master.tenant_id = p_tenant_id
      and stage_master.is_active = true
      and stage_master.deleted_at is null
    where workflow_stages.tenant_id = p_tenant_id
      and workflow_stages.workflow_id = p_workflow_id
      and workflow_stages.is_active = true
      and workflow_stages.deleted_at is null
    order by stage_master.id
    for share of stage_master;
    if not found then
      raise exception 'ACTIVE_WORKFLOW_REQUIRES_ACTIVE_STAGE' using errcode = 'P0001';
    end if;
  end if;
  update workflows set name = btrim(p_name), description = nullif(btrim(p_description), ''), item_type_id = p_item_type_id,
    is_default = p_is_default, is_active = p_is_active, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_workflow_id;
  update item_types set default_workflow_id = null, updated_by = p_actor_id
  where tenant_id = p_tenant_id and default_workflow_id = p_workflow_id;
  if p_is_default then
    update workflows set is_default = false, updated_by = p_actor_id
    where tenant_id = p_tenant_id and item_type_id = p_item_type_id and id <> p_workflow_id and deleted_at is null;
    update item_types set default_workflow_id = p_workflow_id, updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = p_item_type_id;
  end if;
  return p_workflow_id;
end;
$$;
revoke all on function update_workflow_configuration(uuid, uuid, text, text, uuid, boolean, boolean, text) from public, anon, authenticated;
grant execute on function update_workflow_configuration(uuid, uuid, text, text, uuid, boolean, boolean, text) to service_role;

create table order_payment_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  payment_id uuid not null references order_payments(id) on delete restrict,
  reason text not null,
  old_value_json jsonb not null,
  new_value_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint order_payment_corrections_reason_not_blank check (length(btrim(reason)) >= 3)
);

create index order_payment_corrections_tenant_payment_idx
on order_payment_corrections(tenant_id, payment_id, created_at desc);
alter table order_payment_corrections enable row level security;

create or replace function prevent_immutable_audit_change()
returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'IMMUTABLE_AUDIT_RECORD' using errcode = 'P0001';
end;
$$;

create trigger order_payment_corrections_immutable
before update or delete on order_payment_corrections
for each row execute function prevent_immutable_audit_change();

comment on table order_payment_corrections is
  'Immutable tenant-scoped before/after audit trail for order payment corrections.';

create or replace function record_order_payment(
  p_tenant_id uuid, p_order_id uuid, p_amount numeric, p_payment_mode_id uuid,
  p_payment_date date, p_reference_number text, p_notes text, p_actor_id text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_amount numeric(12, 2) := round(p_amount, 2);
  v_payment_id uuid;
  v_payment_total numeric(12, 2);
  v_payment_status payment_status;
begin
  select * into v_order from orders
  where tenant_id = p_tenant_id and id = p_order_id and deleted_at is null for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_amount is null or v_amount < 0.01 then raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = 'P0001'; end if;
  if p_payment_date is null then raise exception 'PAYMENT_DATE_REQUIRED' using errcode = 'P0001'; end if;
  if p_payment_mode_id is not null and not exists (
    select 1 from payment_modes
    where tenant_id = p_tenant_id and id = p_payment_mode_id and is_active = true and deleted_at is null
  ) then raise exception 'PAYMENT_MODE_NOT_FOUND' using errcode = 'P0001'; end if;

  select round(coalesce(sum(amount), 0), 2) into v_payment_total from order_payments
  where tenant_id = p_tenant_id and order_id = p_order_id and deleted_at is null;
  if v_payment_total >= v_order.total_amount then raise exception 'ORDER_FULLY_PAID' using errcode = 'P0001'; end if;
  if v_payment_total + v_amount > v_order.total_amount then raise exception 'PAYMENT_EXCEEDS_ORDER_TOTAL' using errcode = 'P0001'; end if;

  insert into order_payments (
    tenant_id, order_id, amount, payment_mode_id, payment_date, reference_number, notes, created_by
  ) values (
    p_tenant_id, p_order_id, v_amount, p_payment_mode_id, p_payment_date,
    nullif(btrim(p_reference_number), ''), nullif(btrim(p_notes), ''), p_actor_id
  ) returning id into v_payment_id;

  v_payment_total := round(v_payment_total + v_amount, 2);
  v_payment_status := case
    when v_payment_total <= 0 then 'unpaid'::payment_status
    when v_payment_total >= v_order.total_amount then 'paid'::payment_status
    else 'partially_paid'::payment_status
  end;
  update orders set amount_paid = v_payment_total, payment_status = v_payment_status, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_order_id;
  return jsonb_build_object('payment_id', v_payment_id, 'order_id', p_order_id, 'amount_paid', v_payment_total, 'payment_status', v_payment_status);
end;
$$;

revoke all on function record_order_payment(uuid, uuid, numeric, uuid, date, text, text, text) from public, anon, authenticated;
grant execute on function record_order_payment(uuid, uuid, numeric, uuid, date, text, text, text) to service_role;

create or replace function correct_order_payment(
  p_tenant_id uuid, p_payment_id uuid, p_amount numeric, p_payment_mode_id uuid,
  p_payment_date date, p_reference_number text, p_notes text, p_reason text, p_actor_id text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_payment order_payments%rowtype;
  v_amount numeric(12, 2) := round(p_amount, 2);
  v_order_id uuid;
  v_other_total numeric(12, 2);
  v_payment_total numeric(12, 2);
  v_payment_status payment_status;
  v_old_value jsonb;
  v_new_value jsonb;
begin
  select order_id into v_order_id from order_payments
  where tenant_id = p_tenant_id and id = p_payment_id and deleted_at is null;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001'; end if;

  select * into v_order from orders
  where tenant_id = p_tenant_id and id = v_order_id and deleted_at is null for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_payment from order_payments
  where tenant_id = p_tenant_id and id = p_payment_id and order_id = v_order_id and deleted_at is null for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_amount is null or v_amount < 0.01 then raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = 'P0001'; end if;
  if p_payment_date is null then raise exception 'PAYMENT_DATE_REQUIRED' using errcode = 'P0001'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'CORRECTION_REASON_REQUIRED' using errcode = 'P0001'; end if;
  if p_payment_mode_id is not null and not exists (
    select 1 from payment_modes where tenant_id = p_tenant_id and id = p_payment_mode_id and deleted_at is null
  ) then raise exception 'PAYMENT_MODE_NOT_FOUND' using errcode = 'P0001'; end if;

  select round(coalesce(sum(amount), 0), 2) into v_other_total from order_payments
  where tenant_id = p_tenant_id and order_id = v_order_id and id <> p_payment_id and deleted_at is null;
  if v_other_total + v_amount > v_order.total_amount then raise exception 'PAYMENT_EXCEEDS_ORDER_TOTAL' using errcode = 'P0001'; end if;

  v_old_value := jsonb_build_object(
    'amount', v_payment.amount, 'payment_mode_id', v_payment.payment_mode_id,
    'payment_date', v_payment.payment_date, 'reference_number', v_payment.reference_number, 'notes', v_payment.notes
  );
  v_new_value := jsonb_build_object(
    'amount', v_amount, 'payment_mode_id', p_payment_mode_id, 'payment_date', p_payment_date,
    'reference_number', nullif(btrim(p_reference_number), ''), 'notes', nullif(btrim(p_notes), '')
  );
  update order_payments set amount = v_amount, payment_mode_id = p_payment_mode_id,
    payment_date = p_payment_date, reference_number = nullif(btrim(p_reference_number), ''), notes = nullif(btrim(p_notes), '')
  where tenant_id = p_tenant_id and id = p_payment_id;
  insert into order_payment_corrections (
    tenant_id, order_id, payment_id, reason, old_value_json, new_value_json, created_by
  ) values (p_tenant_id, v_order_id, p_payment_id, btrim(p_reason), v_old_value, v_new_value, p_actor_id);

  v_payment_total := round(v_other_total + v_amount, 2);
  v_payment_status := case
    when v_payment_total <= 0 then 'unpaid'::payment_status
    when v_payment_total >= v_order.total_amount then 'paid'::payment_status
    else 'partially_paid'::payment_status
  end;
  update orders set amount_paid = v_payment_total, payment_status = v_payment_status, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_order_id;
  return jsonb_build_object('payment_id', p_payment_id, 'order_id', v_order_id, 'amount_paid', v_payment_total, 'payment_status', v_payment_status);
end;
$$;

revoke all on function correct_order_payment(uuid, uuid, numeric, uuid, date, text, text, text, text) from public, anon, authenticated;
grant execute on function correct_order_payment(uuid, uuid, numeric, uuid, date, text, text, text, text) to service_role;
