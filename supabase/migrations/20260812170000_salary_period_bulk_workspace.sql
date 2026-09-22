alter table salary_workflow_operations
drop constraint salary_workflow_operations_type_check;

alter table salary_workflow_operations
add constraint salary_workflow_operations_type_check check (
  operation_type in (
    'create_period',
    'update_period',
    'regenerate_period',
    'finalize_calculation',
    'finalize_period_bulk',
    'pay_period_bulk'
  )
);

create or replace function finalize_salary_calculations_bulk(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_rows jsonb,
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
  v_calculation_id uuid;
  v_canonical_rows jsonb;
  v_existing_result jsonb;
  v_expected_updated_at timestamptz;
  v_finalized_amount numeric;
  v_note text;
  v_result jsonb;
  v_row jsonb;
  v_row_count integer;
  v_unique_count integer;
  v_request_fingerprint text;
begin
  if p_idempotency_key is null then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'SALARY_BULK_ROWS_EMPTY';
  end if;

  select jsonb_agg(value order by value ->> 'calculationId')
  into v_canonical_rows
  from jsonb_array_elements(p_rows);

  select count(*), count(distinct (value ->> 'calculationId'))
  into v_row_count, v_unique_count
  from jsonb_array_elements(v_canonical_rows);

  if v_row_count <> v_unique_count then
    raise exception 'SALARY_BULK_DUPLICATE_CALCULATION';
  end if;

  v_request_fingerprint := md5(
    'finalize_period_bulk:' || p_salary_period_id::text || ':' || v_canonical_rows::text
  );

  v_existing_result := salary_workflow_receipt(
    p_tenant_id,
    p_idempotency_key,
    'finalize_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  perform lock_salary_period(p_tenant_id, p_salary_period_id);

  v_existing_result := salary_workflow_receipt(
    p_tenant_id,
    p_idempotency_key,
    'finalize_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  for v_row in
    select value from jsonb_array_elements(v_canonical_rows)
  loop
    begin
      v_calculation_id := (v_row ->> 'calculationId')::uuid;
      v_expected_updated_at := (v_row ->> 'expectedUpdatedAt')::timestamptz;
      v_finalized_amount := (v_row ->> 'finalizedPayableAmount')::numeric;
    exception when others then
      raise exception 'SALARY_BULK_ROW_INVALID';
    end;
    v_note := nullif(trim(v_row ->> 'finalizationNote'), '');

    select * into v_calculation
    from salary_calculations
    where id = v_calculation_id
      and tenant_id = p_tenant_id
      and salary_period_id = p_salary_period_id
      and deleted_at is null
    for update;

    if not found then raise exception 'SALARY_CALCULATION_INVALID'; end if;
    if v_calculation.updated_at is distinct from v_expected_updated_at then
      raise exception 'SALARY_BULK_STALE_ROW';
    end if;
    if v_finalized_amount is null or v_finalized_amount < 0 then
      raise exception 'SALARY_PAYABLE_INVALID';
    end if;
    if v_finalized_amount < v_calculation.amount_paid then
      raise exception 'SALARY_PAYABLE_BELOW_PAID';
    end if;
    if v_finalized_amount <> v_calculation.final_payable and v_note is null then
      raise exception 'SALARY_FINALIZATION_NOTE_REQUIRED';
    end if;
    if v_calculation.finalized_payable_amount is not null
       and (
         v_finalized_amount <> v_calculation.finalized_payable_amount
         or v_note is distinct from v_calculation.finalization_note
       )
       and v_note is null then
      raise exception 'SALARY_FINALIZATION_NOTE_REQUIRED';
    end if;
  end loop;

  for v_row in
    select value from jsonb_array_elements(v_canonical_rows)
  loop
    perform finalize_salary_calculation(
      p_tenant_id,
      (v_row ->> 'calculationId')::uuid,
      (v_row ->> 'finalizedPayableAmount')::numeric,
      nullif(trim(v_row ->> 'finalizationNote'), ''),
      p_actor_id,
      gen_random_uuid()
    );
  end loop;

  v_result := jsonb_build_object(
    'periodId', p_salary_period_id,
    'finalizedCount', v_row_count,
    'status', (
      select status
      from salary_periods
      where id = p_salary_period_id and tenant_id = p_tenant_id
    )
  );

  insert into salary_workflow_operations (
    tenant_id,
    operation_type,
    target_key,
    request_fingerprint,
    payload_fingerprint,
    idempotency_key,
    result_json,
    created_by
  ) values (
    p_tenant_id,
    'finalize_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint,
    md5(v_canonical_rows::text),
    p_idempotency_key,
    v_result,
    p_actor_id
  );

  return v_result;
end;
$$;

revoke all on function finalize_salary_calculations_bulk(uuid, uuid, jsonb, text, uuid)
from public, anon, authenticated;

grant execute on function finalize_salary_calculations_bulk(uuid, uuid, jsonb, text, uuid)
to service_role;

comment on function finalize_salary_calculations_bulk(uuid, uuid, jsonb, text, uuid)
is 'Atomically finalizes selected salary calculations with stale-row validation and immutable per-worker audit history.';

create or replace function record_salary_payments_bulk(
  p_tenant_id uuid,
  p_salary_period_id uuid,
  p_rows jsonb,
  p_payment_date date,
  p_payment_mode_id uuid,
  p_description text,
  p_actor_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_calculation salary_calculations%rowtype;
  v_calculation_id uuid;
  v_canonical_rows jsonb;
  v_description text;
  v_existing_result jsonb;
  v_expected_updated_at timestamptz;
  v_result jsonb;
  v_row jsonb;
  v_row_count integer;
  v_unique_count integer;
  v_request_fingerprint text;
  v_total numeric := 0;
begin
  if p_idempotency_key is null then
    raise exception 'SALARY_WORKFLOW_IDEMPOTENCY_REQUIRED';
  end if;

  if p_payment_date is null then
    raise exception 'SALARY_PAYMENT_DATE_REQUIRED';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'SALARY_BULK_ROWS_EMPTY';
  end if;

  perform 1
  from payment_modes
  where id = p_payment_mode_id
    and tenant_id = p_tenant_id
    and is_active = true
    and deleted_at is null;
  if not found then raise exception 'WORKER_MONEY_PAYMENT_MODE_INVALID'; end if;

  select jsonb_agg(value order by value ->> 'calculationId')
  into v_canonical_rows
  from jsonb_array_elements(p_rows);

  select count(*), count(distinct (value ->> 'calculationId'))
  into v_row_count, v_unique_count
  from jsonb_array_elements(v_canonical_rows);
  if v_row_count <> v_unique_count then
    raise exception 'SALARY_BULK_DUPLICATE_CALCULATION';
  end if;

  v_description := nullif(trim(p_description), '');
  v_request_fingerprint := md5(
    'pay_period_bulk:' || p_salary_period_id::text || ':' || v_canonical_rows::text || ':' ||
    p_payment_date::text || ':' || p_payment_mode_id::text || ':' || coalesce(v_description, '')
  );

  v_existing_result := salary_workflow_receipt(
    p_tenant_id,
    p_idempotency_key,
    'pay_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  perform lock_salary_period(p_tenant_id, p_salary_period_id);

  v_existing_result := salary_workflow_receipt(
    p_tenant_id,
    p_idempotency_key,
    'pay_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint
  );
  if v_existing_result is not null then return v_existing_result; end if;

  for v_row in
    select value from jsonb_array_elements(v_canonical_rows)
  loop
    begin
      v_calculation_id := (v_row ->> 'calculationId')::uuid;
      v_expected_updated_at := (v_row ->> 'expectedUpdatedAt')::timestamptz;
      v_amount := (v_row ->> 'amount')::numeric;
    exception when others then
      raise exception 'SALARY_BULK_ROW_INVALID';
    end;

    select * into v_calculation
    from salary_calculations
    where id = v_calculation_id
      and tenant_id = p_tenant_id
      and salary_period_id = p_salary_period_id
      and deleted_at is null
    for update;

    if not found then raise exception 'SALARY_CALCULATION_INVALID'; end if;
    if v_calculation.updated_at is distinct from v_expected_updated_at then
      raise exception 'SALARY_BULK_STALE_ROW';
    end if;
    if v_calculation.finalized_payable_amount is null then
      raise exception 'WORKER_MONEY_SALARY_NOT_FINALIZED';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'WORKER_MONEY_AMOUNT_INVALID';
    end if;
    if v_amount > v_calculation.finalized_payable_amount - v_calculation.amount_paid then
      raise exception 'WORKER_MONEY_SALARY_OVERPAY';
    end if;

    v_total := v_total + v_amount;
  end loop;

  for v_row in
    select value from jsonb_array_elements(v_canonical_rows)
  loop
    select * into v_calculation
    from salary_calculations
    where id = (v_row ->> 'calculationId')::uuid
      and tenant_id = p_tenant_id
      and salary_period_id = p_salary_period_id
      and deleted_at is null;

    perform record_worker_money_entry_without_period_lock(
      p_tenant_id,
      v_calculation.worker_id,
      'salary_paid',
      (v_row ->> 'amount')::numeric,
      p_payment_date,
      null,
      p_payment_mode_id,
      p_salary_period_id,
      v_description,
      p_actor_id,
      gen_random_uuid()
    );
  end loop;

  v_result := jsonb_build_object(
    'periodId', p_salary_period_id,
    'paymentCount', v_row_count,
    'paidAmount', v_total,
    'status', (
      select status
      from salary_periods
      where id = p_salary_period_id and tenant_id = p_tenant_id
    )
  );

  insert into salary_workflow_operations (
    tenant_id,
    operation_type,
    target_key,
    request_fingerprint,
    payload_fingerprint,
    idempotency_key,
    result_json,
    created_by
  ) values (
    p_tenant_id,
    'pay_period_bulk',
    p_salary_period_id::text,
    v_request_fingerprint,
    md5(v_canonical_rows::text),
    p_idempotency_key,
    v_result,
    p_actor_id
  );

  return v_result;
end;
$$;

revoke all on function record_salary_payments_bulk(uuid, uuid, jsonb, date, uuid, text, text, uuid)
from public, anon, authenticated;

grant execute on function record_salary_payments_bulk(uuid, uuid, jsonb, date, uuid, text, text, uuid)
to service_role;

comment on function record_salary_payments_bulk(uuid, uuid, jsonb, date, uuid, text, text, uuid)
is 'Atomically records selected salary payments using one date and payment mode while preserving one worker-ledger entry per worker.';
