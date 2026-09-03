create table salary_workflow_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  operation_type text not null,
  target_key text not null,
  request_fingerprint text not null,
  payload_fingerprint text not null,
  idempotency_key uuid not null,
  result_json jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint salary_workflow_operations_type_check check (
    operation_type in ('create_period', 'update_period', 'regenerate_period', 'finalize_calculation')
  ),
  constraint salary_workflow_operations_tenant_key_unique unique (tenant_id, idempotency_key)
);

create table salary_calculation_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  salary_calculation_id uuid not null references salary_calculations(id) on delete restrict,
  salary_period_id uuid not null references salary_periods(id) on delete restrict,
  worker_id uuid not null references workers(id) on delete restrict,
  previous_finalized_payable_amount numeric(12, 2),
  new_finalized_payable_amount numeric(12, 2) not null,
  previous_finalization_note text,
  new_finalization_note text,
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint salary_calculation_revisions_amount_check check (
    previous_finalized_payable_amount is null
    or previous_finalized_payable_amount >= 0
  ),
  constraint salary_calculation_revisions_new_amount_check check (
    new_finalized_payable_amount >= 0
  )
);

create index salary_workflow_operations_tenant_created_idx
on salary_workflow_operations(tenant_id, created_at desc);

create index salary_calculation_revisions_calculation_idx
on salary_calculation_revisions(tenant_id, salary_calculation_id, created_at desc);

alter table salary_workflow_operations enable row level security;
alter table salary_calculation_revisions enable row level security;
alter table worker_ledger add column request_fingerprint text;

alter function record_worker_money_entry(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid)
rename to record_worker_money_entry_without_period_lock;
alter function correct_worker_money_entry(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid)
rename to correct_worker_money_entry_without_period_lock;
alter function reverse_worker_money_entry(uuid, uuid, text, text)
rename to reverse_worker_money_entry_without_period_lock;

create or replace function create_worker_configuration(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_joining_date date,
  p_primary_workgroup_id uuid,
  p_wage_type worker_wage_type,
  p_wage_amount numeric,
  p_notes text,
  p_workgroup_ids uuid[],
  p_actor_id text
)
returns workers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker workers%rowtype;
  v_workgroup_ids uuid[] := coalesce(p_workgroup_ids, '{}'::uuid[]);
begin
  perform 1 from tenants where id = p_tenant_id for update;
  if not found then raise exception 'TENANT_NOT_FOUND'; end if;
  if p_wage_amount < 0 then raise exception 'INVALID_WAGE_AMOUNT'; end if;

  if p_primary_workgroup_id is not null and not (p_primary_workgroup_id = any(v_workgroup_ids)) then
    v_workgroup_ids := array_append(v_workgroup_ids, p_primary_workgroup_id);
  end if;
  select coalesce(array_agg(distinct value), '{}'::uuid[]) into v_workgroup_ids
  from unnest(v_workgroup_ids) value;

  if exists (
    select 1 from unnest(v_workgroup_ids) selected_id
    where not exists (
      select 1 from workgroups
      where tenant_id = p_tenant_id and id = selected_id and is_active = true and deleted_at is null
    )
  ) then raise exception 'WORKGROUP_NOT_FOUND'; end if;

  insert into workers (
    tenant_id, name, phone, joining_date, primary_workgroup_id, wage_type, wage_amount, notes, created_by, updated_by
  ) values (
    p_tenant_id, btrim(p_name), nullif(btrim(p_phone), ''), p_joining_date, p_primary_workgroup_id,
    p_wage_type, p_wage_amount, nullif(btrim(p_notes), ''), p_actor_id, p_actor_id
  ) returning * into v_worker;

  insert into worker_workgroups (tenant_id, worker_id, workgroup_id, created_by)
  select p_tenant_id, v_worker.id, workgroup_id, p_actor_id from unnest(v_workgroup_ids) workgroup_id;
  return v_worker;
end;
$$;

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
  perform 1 from tenants where id = p_tenant_id for update;
  if not found then raise exception 'TENANT_NOT_FOUND'; end if;
  perform 1 from workers
  where tenant_id = p_tenant_id and id = p_worker_id and deleted_at is null
  for update;
  if not found then raise exception 'WORKER_NOT_FOUND'; end if;
  if p_wage_amount < 0 then raise exception 'INVALID_WAGE_AMOUNT'; end if;
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
  ) then raise exception 'WORKGROUP_NOT_FOUND'; end if;
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

create trigger salary_workflow_operations_immutable
before update or delete on salary_workflow_operations
for each row execute function prevent_immutable_audit_change();

create trigger salary_calculation_revisions_immutable
before update or delete on salary_calculation_revisions
for each row execute function prevent_immutable_audit_change();

create or replace function lock_salary_period(
  p_tenant_id uuid,
  p_salary_period_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from salary_periods
  where id = p_salary_period_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;
  if not found then raise exception 'WORKER_MONEY_SALARY_PERIOD_INVALID'; end if;
end;
$$;

create or replace function record_worker_money_entry(
  p_tenant_id uuid,
  p_worker_id uuid,
  p_transaction_type worker_ledger_transaction_type,
  p_amount numeric,
  p_transaction_date date,
  p_balance_account text,
  p_payment_mode_id uuid,
  p_linked_salary_period_id uuid,
  p_description text,
  p_actor_id text,
  p_idempotency_key uuid
)
returns worker_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry worker_ledger%rowtype;
  v_request_fingerprint text := md5(jsonb_build_object(
    'workerId', p_worker_id,
    'transactionType', p_transaction_type,
    'amount', p_amount,
    'transactionDate', p_transaction_date,
    'balanceAccount', p_balance_account,
    'paymentModeId', p_payment_mode_id,
    'salaryPeriodId', p_linked_salary_period_id,
    'description', nullif(trim(p_description), '')
  )::text);
begin
  select * into v_entry from worker_ledger
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_entry.request_fingerprint is distinct from v_request_fingerprint then
      raise exception 'WORKER_MONEY_IDEMPOTENCY_CONFLICT';
    end if;
    return v_entry;
  end if;
  if p_transaction_type = 'salary_paid' then
    perform lock_salary_period(p_tenant_id, p_linked_salary_period_id);
  end if;
  v_entry := record_worker_money_entry_without_period_lock(
    p_tenant_id, p_worker_id, p_transaction_type, p_amount, p_transaction_date,
    p_balance_account, p_payment_mode_id, p_linked_salary_period_id,
    p_description, p_actor_id, p_idempotency_key
  );
  select * into v_entry from worker_ledger where id = v_entry.id for update;
  if v_entry.request_fingerprint is null then
    update worker_ledger set request_fingerprint = v_request_fingerprint
    where id = v_entry.id returning * into v_entry;
  elsif v_entry.request_fingerprint <> v_request_fingerprint then
    raise exception 'WORKER_MONEY_IDEMPOTENCY_CONFLICT';
  end if;
  return v_entry;
end;
$$;

create or replace function correct_worker_money_entry(
  p_tenant_id uuid,
  p_entry_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_balance_account text,
  p_payment_mode_id uuid,
  p_description text,
  p_reason text,
  p_actor_id text,
  p_idempotency_key uuid
)
returns worker_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry worker_ledger%rowtype;
  v_original worker_ledger%rowtype;
  v_request_fingerprint text := md5(jsonb_build_object(
    'entryId', p_entry_id,
    'amount', p_amount,
    'transactionDate', p_transaction_date,
    'balanceAccount', p_balance_account,
    'paymentModeId', p_payment_mode_id,
    'description', nullif(trim(p_description), ''),
    'reason', trim(p_reason)
  )::text);
begin
  select * into v_entry from worker_ledger
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_entry.request_fingerprint is distinct from v_request_fingerprint then
      raise exception 'WORKER_MONEY_IDEMPOTENCY_CONFLICT';
    end if;
    return v_entry;
  end if;
  select * into v_original from worker_ledger
  where id = p_entry_id and tenant_id = p_tenant_id and deleted_at is null;
  if v_original.transaction_type = 'salary_paid' then
    perform lock_salary_period(p_tenant_id, v_original.linked_salary_period_id);
  end if;
  v_entry := correct_worker_money_entry_without_period_lock(
    p_tenant_id, p_entry_id, p_amount, p_transaction_date, p_balance_account,
    p_payment_mode_id, p_description, p_reason, p_actor_id, p_idempotency_key
  );
  select * into v_entry from worker_ledger where id = v_entry.id for update;
  if v_entry.request_fingerprint is null then
    update worker_ledger set request_fingerprint = v_request_fingerprint
    where id = v_entry.id returning * into v_entry;
  elsif v_entry.request_fingerprint <> v_request_fingerprint then
    raise exception 'WORKER_MONEY_IDEMPOTENCY_CONFLICT';
  end if;
  return v_entry;
end;
$$;

create or replace function reverse_worker_money_entry(
  p_tenant_id uuid,
  p_entry_id uuid,
  p_reason text,
  p_actor_id text
)
returns worker_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original worker_ledger%rowtype;
begin
  select * into v_original from worker_ledger
  where id = p_entry_id and tenant_id = p_tenant_id and deleted_at is null;
  if v_original.transaction_type = 'salary_paid' then
    perform lock_salary_period(p_tenant_id, v_original.linked_salary_period_id);
  end if;
  return reverse_worker_money_entry_without_period_lock(p_tenant_id, p_entry_id, p_reason, p_actor_id);
end;
$$;

create or replace function insert_salary_calculation_payload(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_calculations jsonb,
  p_actor_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  perform 1
  from salary_periods
  where id = p_salary_period_id
    and tenant_id = p_tenant_id
    and deleted_at is null;
  if not found then
    raise exception 'SALARY_PERIOD_INVALID';
  end if;

  if jsonb_typeof(coalesce(p_calculations, '[]'::jsonb)) <> 'array' then
    raise exception 'SALARY_CALCULATIONS_INVALID';
  end if;

  if jsonb_array_length(coalesce(p_calculations, '[]'::jsonb)) = 0 then
    raise exception 'SALARY_CALCULATIONS_EMPTY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_calculations, '[]'::jsonb)) as row_data(worker_id uuid)
    group by row_data.worker_id
    having row_data.worker_id is null or count(*) > 1
  ) then
    raise exception 'SALARY_CALCULATIONS_DUPLICATE_WORKER';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_calculations, '[]'::jsonb)) as row_data(worker_id uuid)
    left join workers worker
      on worker.id = row_data.worker_id
      and worker.tenant_id = p_tenant_id
      and worker.status = 'active'
      and worker.deleted_at is null
    where worker.id is null
  ) then
    raise exception 'SALARY_CALCULATIONS_WORKER_INVALID';
  end if;

  if exists (
    select 1
    from workers worker
    where worker.tenant_id = p_tenant_id
      and worker.status = 'active'
      and worker.deleted_at is null
      and not exists (
        select 1
        from jsonb_to_recordset(coalesce(p_calculations, '[]'::jsonb)) as row_data(worker_id uuid)
        where row_data.worker_id = worker.id
      )
  ) then
    raise exception 'SALARY_CALCULATIONS_INCOMPLETE';
  end if;

  insert into salary_calculations (
    tenant_id,
    salary_period_id,
    worker_id,
    wage_type,
    wage_amount,
    attendance_days,
    attendance_hours,
    productive_minutes,
    gross_suggested_amount,
    advance_deduction,
    loan_deduction,
    other_deduction,
    repayment_credit,
    manual_adjustment,
    final_payable,
    amount_paid,
    payment_status,
    notes,
    created_by,
    updated_by
  )
  select
    p_tenant_id,
    p_salary_period_id,
    row_data.worker_id,
    row_data.wage_type::worker_wage_type,
    coalesce(row_data.wage_amount, 0),
    coalesce(row_data.attendance_days, 0),
    coalesce(row_data.attendance_hours, 0),
    coalesce(row_data.productive_minutes, 0),
    coalesce(row_data.gross_suggested_amount, 0),
    coalesce(row_data.advance_deduction, 0),
    coalesce(row_data.loan_deduction, 0),
    coalesce(row_data.other_deduction, 0),
    coalesce(row_data.repayment_credit, 0),
    coalesce(row_data.manual_adjustment, 0),
    coalesce(row_data.final_payable, 0),
    0,
    'unpaid'::salary_payment_status,
    nullif(trim(row_data.notes), ''),
    p_actor_id,
    p_actor_id
  from jsonb_to_recordset(coalesce(p_calculations, '[]'::jsonb)) as row_data(
    worker_id uuid,
    wage_type text,
    wage_amount numeric,
    attendance_days numeric,
    attendance_hours numeric,
    productive_minutes integer,
    gross_suggested_amount numeric,
    advance_deduction numeric,
    loan_deduction numeric,
    other_deduction numeric,
    repayment_credit numeric,
    manual_adjustment numeric,
    final_payable numeric,
    notes text
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function salary_workflow_receipt(
  p_tenant_id uuid,
  p_idempotency_key uuid,
  p_operation_type text,
  p_target_key text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation salary_workflow_operations%rowtype;
begin
  select * into v_operation
  from salary_workflow_operations
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;

  if v_operation.operation_type <> p_operation_type
     or v_operation.target_key <> p_target_key
     or v_operation.request_fingerprint <> p_request_fingerprint then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_CONFLICT';
  end if;

  return v_operation.result_json;
end;
$$;

create or replace function get_salary_workflow_result(
  p_tenant_id uuid,
  p_idempotency_key uuid,
  p_operation_type text,
  p_target_key text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, p_operation_type, p_target_key, p_request_fingerprint
  );
end;
$$;

create or replace function create_salary_period_with_calculations(
  p_tenant_id uuid,
  p_period_start date,
  p_period_end date,
  p_calculations jsonb,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_result jsonb;
  v_inserted integer;
  v_period salary_periods%rowtype;
  v_result jsonb;
  v_target_key text := p_period_start::text || ':' || p_period_end::text;
  v_request_fingerprint text := md5('create_period:' || p_period_start::text || ':' || p_period_end::text);
  v_payload_fingerprint text := md5(coalesce(p_calculations, '[]'::jsonb)::text);
begin
  if p_idempotency_key is null then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED';
  end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'create_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  perform 1 from tenants where id = p_tenant_id for update;
  if not found then raise exception 'SALARY_TENANT_INVALID'; end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'create_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'SALARY_PERIOD_RANGE_INVALID';
  end if;

  if exists (
    select 1
    from salary_periods
    where tenant_id = p_tenant_id
      and deleted_at is null
      and period_start <= p_period_end
      and period_end >= p_period_start
  ) then
    raise exception 'SALARY_PERIOD_OVERLAP';
  end if;

  insert into salary_periods (
    tenant_id, period_start, period_end, status, created_by, updated_by
  ) values (
    p_tenant_id, p_period_start, p_period_end, 'draft', p_actor_id, p_actor_id
  ) returning * into v_period;

  v_inserted := insert_salary_calculation_payload(
    p_tenant_id,
    v_period.id,
    p_calculations,
    p_actor_id
  );

  v_result := jsonb_build_object(
    'periodId', v_period.id,
    'calculationCount', v_inserted,
    'status', v_period.status
  );

  insert into salary_workflow_operations (
    tenant_id, operation_type, target_key, request_fingerprint, payload_fingerprint, idempotency_key, result_json, created_by
  ) values (
    p_tenant_id, 'create_period', v_target_key, v_request_fingerprint, v_payload_fingerprint, p_idempotency_key, v_result, p_actor_id
  );

  return v_result;
end;
$$;

create or replace function regenerate_salary_period_calculations(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_calculations jsonb,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_result jsonb;
  v_inserted integer;
  v_period salary_periods%rowtype;
  v_result jsonb;
  v_target_key text := p_salary_period_id::text;
  v_request_fingerprint text := md5('regenerate_period:' || p_salary_period_id::text);
  v_payload_fingerprint text := md5(coalesce(p_calculations, '[]'::jsonb)::text);
begin
  if p_idempotency_key is null then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED';
  end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'regenerate_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  perform 1 from tenants where id = p_tenant_id for update;
  if not found then raise exception 'SALARY_TENANT_INVALID'; end if;

  select * into v_period
  from salary_periods
  where id = p_salary_period_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;
  if not found then raise exception 'SALARY_PERIOD_INVALID'; end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'regenerate_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  if v_period.status <> 'draft' then
    raise exception 'SALARY_PERIOD_NOT_DRAFT';
  end if;

  if exists (
    select 1
    from salary_calculations
    where tenant_id = p_tenant_id
      and salary_period_id = p_salary_period_id
      and deleted_at is null
      and (finalized_payable_amount is not null or amount_paid > 0)
  ) then
    raise exception 'SALARY_PERIOD_HAS_DECISIONS';
  end if;

  update salary_calculations
  set deleted_at = now(), updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and salary_period_id = p_salary_period_id
    and deleted_at is null;

  v_inserted := insert_salary_calculation_payload(
    p_tenant_id,
    p_salary_period_id,
    p_calculations,
    p_actor_id
  );

  v_result := jsonb_build_object(
    'periodId', p_salary_period_id,
    'calculationCount', v_inserted,
    'status', v_period.status
  );

  insert into salary_workflow_operations (
    tenant_id, operation_type, target_key, request_fingerprint, payload_fingerprint, idempotency_key, result_json, created_by
  ) values (
    p_tenant_id, 'regenerate_period', v_target_key, v_request_fingerprint, v_payload_fingerprint, p_idempotency_key, v_result, p_actor_id
  );

  return v_result;
end;
$$;

create or replace function update_salary_period_with_calculations(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_period_start date,
  p_period_end date,
  p_calculations jsonb,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_result jsonb;
  v_inserted integer;
  v_period salary_periods%rowtype;
  v_result jsonb;
  v_target_key text := p_salary_period_id::text;
  v_request_fingerprint text := md5(
    'update_period:' || p_salary_period_id::text || ':' || p_period_start::text || ':' || p_period_end::text
  );
  v_payload_fingerprint text := md5(coalesce(p_calculations, '[]'::jsonb)::text);
begin
  if p_idempotency_key is null then raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED'; end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'update_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  perform 1 from tenants where id = p_tenant_id for update;
  if not found then raise exception 'SALARY_TENANT_INVALID'; end if;

  select * into v_period
  from salary_periods
  where id = p_salary_period_id and tenant_id = p_tenant_id and deleted_at is null
  for update;
  if not found then raise exception 'SALARY_PERIOD_INVALID'; end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'update_period', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  if v_period.status <> 'draft' then raise exception 'SALARY_PERIOD_NOT_DRAFT'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'SALARY_PERIOD_RANGE_INVALID';
  end if;
  if exists (
    select 1 from salary_periods
    where tenant_id = p_tenant_id and id <> p_salary_period_id and deleted_at is null
      and period_start <= p_period_end and period_end >= p_period_start
  ) then raise exception 'SALARY_PERIOD_OVERLAP'; end if;
  if exists (
    select 1 from salary_calculations
    where tenant_id = p_tenant_id and salary_period_id = p_salary_period_id and deleted_at is null
      and (finalized_payable_amount is not null or amount_paid > 0)
  ) then raise exception 'SALARY_PERIOD_HAS_DECISIONS'; end if;

  update salary_periods
  set period_start = p_period_start, period_end = p_period_end, updated_by = p_actor_id
  where id = p_salary_period_id and tenant_id = p_tenant_id;

  update salary_calculations
  set deleted_at = now(), updated_by = p_actor_id
  where tenant_id = p_tenant_id and salary_period_id = p_salary_period_id and deleted_at is null;

  v_inserted := insert_salary_calculation_payload(p_tenant_id, p_salary_period_id, p_calculations, p_actor_id);
  v_result := jsonb_build_object(
    'periodId', p_salary_period_id,
    'calculationCount', v_inserted,
    'status', v_period.status,
    'periodStart', p_period_start,
    'periodEnd', p_period_end
  );
  insert into salary_workflow_operations (
    tenant_id, operation_type, target_key, request_fingerprint, payload_fingerprint, idempotency_key, result_json, created_by
  ) values (
    p_tenant_id, 'update_period', v_target_key, v_request_fingerprint, v_payload_fingerprint, p_idempotency_key, v_result, p_actor_id
  );
  return v_result;
end;
$$;

create or replace function refresh_salary_payment_from_ledger(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_worker_id uuid,
  p_actor_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount_paid numeric(12, 2);
  v_calculation salary_calculations%rowtype;
  v_latest_payment worker_ledger%rowtype;
  v_all_finalized boolean;
  v_all_paid boolean;
begin
  perform lock_salary_period(p_tenant_id, p_salary_period_id);

  select * into v_calculation
  from salary_calculations
  where tenant_id = p_tenant_id
    and salary_period_id = p_salary_period_id
    and worker_id = p_worker_id
    and deleted_at is null
  for update;

  if not found then return; end if;

  select coalesce(sum(amount), 0) into v_amount_paid
  from worker_ledger
  where tenant_id = p_tenant_id
    and worker_id = p_worker_id
    and linked_salary_period_id = p_salary_period_id
    and transaction_type = 'salary_paid'
    and deleted_at is null
    and reversed_at is null;

  select * into v_latest_payment
  from worker_ledger
  where tenant_id = p_tenant_id
    and worker_id = p_worker_id
    and linked_salary_period_id = p_salary_period_id
    and transaction_type = 'salary_paid'
    and deleted_at is null
    and reversed_at is null
  order by transaction_date desc, created_at desc, id desc
  limit 1;

  update salary_calculations
  set amount_paid = v_amount_paid,
      payment_date = case when v_latest_payment.id is null then null else v_latest_payment.transaction_date end,
      payment_mode_id = case when v_latest_payment.id is null then null else v_latest_payment.payment_mode_id end,
      payment_status = case
        when coalesce(finalized_payable_amount, final_payable) <= 0 then 'paid'::salary_payment_status
        when v_amount_paid <= 0 then 'unpaid'::salary_payment_status
        when v_amount_paid >= coalesce(finalized_payable_amount, final_payable) then 'paid'::salary_payment_status
        else 'partially_paid'::salary_payment_status
      end,
      updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = v_calculation.id
    and deleted_at is null;

  select
    bool_and(finalized_payable_amount is not null),
    bool_and(
      finalized_payable_amount is not null
      and amount_paid >= finalized_payable_amount
    )
  into v_all_finalized, v_all_paid
  from salary_calculations
  where tenant_id = p_tenant_id
    and salary_period_id = p_salary_period_id
    and deleted_at is null;

  update salary_periods
  set status = case
        when coalesce(v_all_paid, false) then 'paid'::salary_period_status
        when coalesce(v_all_finalized, false) then 'finalized'::salary_period_status
        else 'draft'::salary_period_status
      end,
      updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_salary_period_id
    and deleted_at is null;
end;
$$;

create or replace function finalize_salary_calculation(
  p_tenant_id uuid,
  p_salary_calculation_id uuid,
  p_finalized_payable_amount numeric,
  p_finalization_note text,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calculation salary_calculations%rowtype;
  v_existing_result jsonb;
  v_note text;
  v_period salary_periods%rowtype;
  v_result jsonb;
  v_target_key text := p_salary_calculation_id::text;
  v_request_fingerprint text;
  v_payload_fingerprint text;
begin
  if p_idempotency_key is null then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED';
  end if;

  v_note := nullif(trim(p_finalization_note), '');
  v_request_fingerprint := md5(
    'finalize_calculation:' || p_salary_calculation_id::text || ':' || p_finalized_payable_amount::text || ':' || coalesce(v_note, '')
  );
  v_payload_fingerprint := v_request_fingerprint;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'finalize_calculation', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  select period.* into v_period
  from salary_periods period
  join salary_calculations calculation
    on calculation.salary_period_id = period.id
    and calculation.id = p_salary_calculation_id
    and calculation.tenant_id = p_tenant_id
    and calculation.deleted_at is null
  where period.tenant_id = p_tenant_id
    and period.deleted_at is null
  for update of period;
  if not found then raise exception 'SALARY_CALCULATION_INVALID'; end if;

  select * into v_calculation
  from salary_calculations
  where id = p_salary_calculation_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;
  if not found then raise exception 'SALARY_CALCULATION_INVALID'; end if;

  v_existing_result := salary_workflow_receipt(
    p_tenant_id, p_idempotency_key, 'finalize_calculation', v_target_key, v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  if p_finalized_payable_amount is null or p_finalized_payable_amount < 0 then
    raise exception 'SALARY_PAYABLE_INVALID';
  end if;

  if p_finalized_payable_amount < v_calculation.amount_paid then
    raise exception 'SALARY_PAYABLE_BELOW_PAID';
  end if;

  if p_finalized_payable_amount <> v_calculation.final_payable and v_note is null then
    raise exception 'SALARY_FINALIZATION_NOTE_REQUIRED';
  end if;

  if v_calculation.finalized_payable_amount is not null
     and (
       p_finalized_payable_amount <> v_calculation.finalized_payable_amount
       or v_note is distinct from v_calculation.finalization_note
     )
     and v_note is null then
    raise exception 'SALARY_FINALIZATION_NOTE_REQUIRED';
  end if;

  insert into salary_calculation_revisions (
    tenant_id,
    salary_calculation_id,
    salary_period_id,
    worker_id,
    previous_finalized_payable_amount,
    new_finalized_payable_amount,
    previous_finalization_note,
    new_finalization_note,
    reason,
    created_by
  ) values (
    p_tenant_id,
    v_calculation.id,
    v_calculation.salary_period_id,
    v_calculation.worker_id,
    v_calculation.finalized_payable_amount,
    p_finalized_payable_amount,
    v_calculation.finalization_note,
    v_note,
    coalesce(v_note, 'Confirmed system suggestion'),
    p_actor_id
  );

  update salary_calculations
  set finalized_payable_amount = p_finalized_payable_amount,
      finalized_at = now(),
      finalized_by = p_actor_id,
      finalization_note = v_note,
      updated_by = p_actor_id
  where id = v_calculation.id
    and tenant_id = p_tenant_id
    and deleted_at is null;

  perform refresh_salary_payment_from_ledger(
    p_tenant_id,
    v_calculation.salary_period_id,
    v_calculation.worker_id,
    p_actor_id
  );

  v_result := jsonb_build_object(
    'calculationId', v_calculation.id,
    'periodId', v_calculation.salary_period_id,
    'workerId', v_calculation.worker_id,
    'finalizedPayableAmount', p_finalized_payable_amount
  );

  insert into salary_workflow_operations (
    tenant_id, operation_type, target_key, request_fingerprint, payload_fingerprint, idempotency_key, result_json, created_by
  ) values (
    p_tenant_id, 'finalize_calculation', v_target_key, v_request_fingerprint, v_payload_fingerprint, p_idempotency_key, v_result, p_actor_id
  );

  return v_result;
end;
$$;

revoke all on function insert_salary_calculation_payload(uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function salary_workflow_receipt(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function get_salary_workflow_result(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function lock_salary_period(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function record_worker_money_entry_without_period_lock(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function correct_worker_money_entry_without_period_lock(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function reverse_worker_money_entry_without_period_lock(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function worker_money_balance(uuid, uuid, text, uuid) from service_role;
revoke all on function refresh_salary_payment_from_ledger(uuid, uuid, uuid, text) from service_role;
revoke all on function record_worker_money_entry(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function correct_worker_money_entry(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function reverse_worker_money_entry(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function create_worker_configuration(uuid, text, text, date, uuid, worker_wage_type, numeric, text, uuid[], text) from public, anon, authenticated;
revoke all on function update_worker_configuration(uuid, uuid, text, text, date, worker_status, uuid, worker_wage_type, numeric, text, uuid[], text) from public, anon, authenticated;
revoke all on function create_salary_period_with_calculations(uuid, date, date, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function regenerate_salary_period_calculations(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function update_salary_period_with_calculations(uuid, uuid, date, date, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function finalize_salary_calculation(uuid, uuid, numeric, text, text, uuid) from public, anon, authenticated;

grant execute on function create_salary_period_with_calculations(uuid, date, date, jsonb, text, uuid) to service_role;
grant execute on function get_salary_workflow_result(uuid, uuid, text, text, text) to service_role;
grant execute on function record_worker_money_entry(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid) to service_role;
grant execute on function correct_worker_money_entry(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid) to service_role;
grant execute on function reverse_worker_money_entry(uuid, uuid, text, text) to service_role;
grant execute on function create_worker_configuration(uuid, text, text, date, uuid, worker_wage_type, numeric, text, uuid[], text) to service_role;
grant execute on function update_worker_configuration(uuid, uuid, text, text, date, worker_status, uuid, worker_wage_type, numeric, text, uuid[], text) to service_role;
grant execute on function regenerate_salary_period_calculations(uuid, uuid, jsonb, text, uuid) to service_role;
grant execute on function update_salary_period_with_calculations(uuid, uuid, date, date, jsonb, text, uuid) to service_role;
grant execute on function finalize_salary_calculation(uuid, uuid, numeric, text, text, uuid) to service_role;

comment on table salary_workflow_operations is 'Tenant-scoped retry receipts for atomic salary period and finalization commands.';
comment on table salary_calculation_revisions is 'Immutable before/after audit history for founder-finalized salary payable decisions.';
