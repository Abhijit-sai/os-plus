alter table worker_ledger
  add column balance_account text,
  add column idempotency_key uuid,
  add column corrected_from_entry_id uuid references worker_ledger(id) on delete restrict,
  add column reversed_at timestamptz,
  add column reversed_by text,
  add column reversal_reason text;

update worker_ledger
set balance_account = case
  when transaction_type = 'advance_given' then 'advance'
  when transaction_type = 'loan_given' then 'loan'
  else balance_account
end
where transaction_type in ('advance_given', 'loan_given');

alter table worker_ledger
  add constraint worker_ledger_balance_account_check
    check (balance_account is null or balance_account in ('advance', 'loan')),
  add constraint worker_ledger_reversal_metadata_check
    check (
      (reversed_at is null and reversed_by is null and reversal_reason is null)
      or
      (reversed_at is not null and reversed_by is not null and length(trim(reversal_reason)) >= 3)
    );

create unique index worker_ledger_tenant_idempotency_idx
on worker_ledger(tenant_id, idempotency_key)
where idempotency_key is not null;

create index worker_ledger_tenant_worker_active_money_idx
on worker_ledger(tenant_id, worker_id, transaction_date desc)
where deleted_at is null and reversed_at is null;

create index worker_ledger_corrected_from_idx
on worker_ledger(corrected_from_entry_id)
where corrected_from_entry_id is not null;

create or replace function worker_money_balance(
  p_tenant_id uuid,
  p_worker_id uuid,
  p_balance_account text,
  p_exclude_entry_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
      sum(
        case
          when p_balance_account = 'advance' and transaction_type = 'advance_given' then amount
          when p_balance_account = 'loan' and transaction_type = 'loan_given' then amount
          when transaction_type in ('deduction', 'repayment') and balance_account = p_balance_account then -amount
          else 0
        end
      ),
      0
    )
  from worker_ledger
  where tenant_id = p_tenant_id
    and worker_id = p_worker_id
    and deleted_at is null
    and reversed_at is null
    and (p_exclude_entry_id is null or id <> p_exclude_entry_id);
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
  select * into v_calculation
  from salary_calculations
  where tenant_id = p_tenant_id
    and salary_period_id = p_salary_period_id
    and worker_id = p_worker_id
    and deleted_at is null
  for update;

  if not found then
    return;
  end if;

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
    bool_and(amount_paid >= coalesce(finalized_payable_amount, final_payable))
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
  v_account text;
  v_balance numeric;
  v_entry worker_ledger%rowtype;
  v_salary_calculation salary_calculations%rowtype;
  v_salary_paid numeric(12, 2);
  v_worker workers%rowtype;
begin
  if p_idempotency_key is null then
    raise exception 'WORKER_MONEY_IDEMPOTENCY_REQUIRED';
  end if;

  select * into v_entry
  from worker_ledger
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;

  if found then
    return v_entry;
  end if;

  select * into v_worker
  from workers
  where id = p_worker_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORKER_MONEY_WORKER_INVALID';
  end if;

  if p_transaction_type <> 'salary_paid' and v_worker.status <> 'active' then
    raise exception 'WORKER_MONEY_WORKER_INVALID';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'WORKER_MONEY_AMOUNT_INVALID';
  end if;

  if p_transaction_type in ('advance_given', 'loan_given', 'repayment', 'salary_paid') then
    if p_payment_mode_id is null then
      raise exception 'WORKER_MONEY_PAYMENT_MODE_REQUIRED';
    end if;

    perform 1
    from payment_modes
    where id = p_payment_mode_id
      and tenant_id = p_tenant_id
      and is_active = true
      and deleted_at is null;

    if not found then
      raise exception 'WORKER_MONEY_PAYMENT_MODE_INVALID';
    end if;
  elsif p_payment_mode_id is not null then
    raise exception 'WORKER_MONEY_NON_CASH_PAYMENT_MODE';
  end if;

  if p_linked_salary_period_id is not null then
    perform 1
    from salary_periods
    where id = p_linked_salary_period_id
      and tenant_id = p_tenant_id
      and deleted_at is null;

    if not found then
      raise exception 'WORKER_MONEY_SALARY_PERIOD_INVALID';
    end if;
  end if;

  if p_transaction_type = 'salary_paid' and p_linked_salary_period_id is null then
    raise exception 'WORKER_MONEY_SALARY_PERIOD_REQUIRED';
  end if;

  v_account := case
    when p_transaction_type = 'advance_given' then 'advance'
    when p_transaction_type = 'loan_given' then 'loan'
    when p_transaction_type in ('deduction', 'repayment') then p_balance_account
    else null
  end;

  if p_transaction_type in ('deduction', 'repayment') and v_account not in ('advance', 'loan') then
    raise exception 'WORKER_MONEY_BALANCE_ACCOUNT_REQUIRED';
  end if;

  if p_transaction_type in ('deduction', 'repayment') then
    v_balance := worker_money_balance(p_tenant_id, p_worker_id, v_account);
    if p_amount > v_balance then
      raise exception 'WORKER_MONEY_BALANCE_EXCEEDED';
    end if;
  end if;

  if p_transaction_type = 'salary_paid' then
    select * into v_salary_calculation
    from salary_calculations
    where tenant_id = p_tenant_id
      and salary_period_id = p_linked_salary_period_id
      and worker_id = p_worker_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'WORKER_MONEY_SALARY_CALCULATION_INVALID';
    end if;

    if v_salary_calculation.finalized_payable_amount is null then
      raise exception 'WORKER_MONEY_SALARY_NOT_FINALIZED';
    end if;

    select coalesce(sum(amount), 0) into v_salary_paid
    from worker_ledger
    where tenant_id = p_tenant_id
      and worker_id = p_worker_id
      and linked_salary_period_id = p_linked_salary_period_id
      and transaction_type = 'salary_paid'
      and deleted_at is null
      and reversed_at is null;

    if v_salary_paid + p_amount > v_salary_calculation.finalized_payable_amount then
      raise exception 'WORKER_MONEY_SALARY_OVERPAY';
    end if;
  end if;

  insert into worker_ledger (
    tenant_id,
    worker_id,
    transaction_type,
    amount,
    transaction_date,
    description,
    linked_salary_period_id,
    payment_mode_id,
    balance_account,
    idempotency_key,
    created_by
  ) values (
    p_tenant_id,
    p_worker_id,
    p_transaction_type,
    p_amount,
    p_transaction_date,
    nullif(trim(p_description), ''),
    p_linked_salary_period_id,
    p_payment_mode_id,
    v_account,
    p_idempotency_key,
    p_actor_id
  )
  returning * into v_entry;

  if p_transaction_type = 'salary_paid' then
    perform refresh_salary_payment_from_ledger(
      p_tenant_id,
      p_linked_salary_period_id,
      p_worker_id,
      p_actor_id
    );
  end if;

  return v_entry;
exception
  when unique_violation then
    select * into v_entry
    from worker_ledger
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if found then return v_entry; end if;
    raise;
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
  v_account text;
  v_available numeric;
  v_entry worker_ledger%rowtype;
  v_original worker_ledger%rowtype;
  v_other_salary_paid numeric(12, 2);
  v_salary_calculation salary_calculations%rowtype;
begin
  if p_idempotency_key is null then
    raise exception 'WORKER_MONEY_IDEMPOTENCY_REQUIRED';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'WORKER_MONEY_CORRECTION_REASON_REQUIRED';
  end if;

  select * into v_entry
  from worker_ledger
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then return v_entry; end if;

  select * into v_original
  from worker_ledger
  where id = p_entry_id
    and tenant_id = p_tenant_id
    and deleted_at is null
    and reversed_at is null
  for update;

  if not found then
    select * into v_entry
    from worker_ledger
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if found then return v_entry; end if;
    raise exception 'WORKER_MONEY_ENTRY_INVALID';
  end if;

  perform 1
  from workers
  where id = v_original.worker_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'WORKER_MONEY_WORKER_INVALID';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'WORKER_MONEY_AMOUNT_INVALID';
  end if;

  if v_original.transaction_type in ('advance_given', 'loan_given', 'repayment', 'salary_paid') then
    if p_payment_mode_id is null then
      raise exception 'WORKER_MONEY_PAYMENT_MODE_REQUIRED';
    end if;
    perform 1 from payment_modes
    where id = p_payment_mode_id and tenant_id = p_tenant_id and is_active = true and deleted_at is null;
    if not found then raise exception 'WORKER_MONEY_PAYMENT_MODE_INVALID'; end if;
  elsif p_payment_mode_id is not null then
    raise exception 'WORKER_MONEY_NON_CASH_PAYMENT_MODE';
  end if;

  v_account := case
    when v_original.transaction_type = 'advance_given' then 'advance'
    when v_original.transaction_type = 'loan_given' then 'loan'
    when v_original.transaction_type in ('deduction', 'repayment') then p_balance_account
    else null
  end;

  if v_original.transaction_type in ('deduction', 'repayment') and v_account not in ('advance', 'loan') then
    raise exception 'WORKER_MONEY_BALANCE_ACCOUNT_REQUIRED';
  end if;

  if v_original.transaction_type in ('deduction', 'repayment') then
    v_available := worker_money_balance(p_tenant_id, v_original.worker_id, v_account, v_original.id);
    if p_amount > v_available then raise exception 'WORKER_MONEY_BALANCE_EXCEEDED'; end if;
  elsif v_original.transaction_type in ('advance_given', 'loan_given') then
    v_available := worker_money_balance(p_tenant_id, v_original.worker_id, v_account, v_original.id);
    if v_available + p_amount < 0 then raise exception 'WORKER_MONEY_BALANCE_EXCEEDED'; end if;
  end if;

  if v_original.transaction_type = 'salary_paid' then
    select * into v_salary_calculation
    from salary_calculations
    where tenant_id = p_tenant_id
      and salary_period_id = v_original.linked_salary_period_id
      and worker_id = v_original.worker_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'WORKER_MONEY_SALARY_CALCULATION_INVALID';
    end if;

    select coalesce(sum(amount), 0) into v_other_salary_paid
    from worker_ledger
    where tenant_id = p_tenant_id
      and worker_id = v_original.worker_id
      and linked_salary_period_id = v_original.linked_salary_period_id
      and transaction_type = 'salary_paid'
      and id <> v_original.id
      and deleted_at is null
      and reversed_at is null;

    if v_other_salary_paid + p_amount > coalesce(
      v_salary_calculation.finalized_payable_amount,
      v_salary_calculation.final_payable
    ) then
      raise exception 'WORKER_MONEY_SALARY_OVERPAY';
    end if;
  end if;

  update worker_ledger
  set reversed_at = now(),
      reversed_by = p_actor_id,
      reversal_reason = trim(p_reason)
  where id = v_original.id;

  insert into worker_ledger (
    tenant_id, worker_id, transaction_type, amount, transaction_date, description,
    linked_salary_period_id, payment_mode_id, balance_account, idempotency_key,
    corrected_from_entry_id, created_by
  ) values (
    p_tenant_id, v_original.worker_id, v_original.transaction_type, p_amount,
    p_transaction_date, nullif(trim(p_description), ''),
    v_original.linked_salary_period_id, p_payment_mode_id, v_account,
    p_idempotency_key, v_original.id, p_actor_id
  ) returning * into v_entry;

  if v_original.transaction_type = 'salary_paid' then
    perform refresh_salary_payment_from_ledger(
      p_tenant_id,
      v_original.linked_salary_period_id,
      v_original.worker_id,
      p_actor_id
    );
  end if;

  return v_entry;
exception
  when unique_violation then
    select * into v_entry
    from worker_ledger
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if found then return v_entry; end if;
    raise;
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
  v_remaining numeric;
  v_original worker_ledger%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'WORKER_MONEY_CORRECTION_REASON_REQUIRED';
  end if;

  select * into v_original
  from worker_ledger
  where id = p_entry_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;

  if not found then raise exception 'WORKER_MONEY_ENTRY_INVALID'; end if;
  if v_original.reversed_at is not null then return v_original; end if;

  perform 1
  from workers
  where id = v_original.worker_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;
  if not found then raise exception 'WORKER_MONEY_WORKER_INVALID'; end if;

  if v_original.transaction_type in ('advance_given', 'loan_given') then
    v_remaining := worker_money_balance(
      p_tenant_id,
      v_original.worker_id,
      v_original.balance_account,
      v_original.id
    );
    if v_remaining < 0 then raise exception 'WORKER_MONEY_BALANCE_EXCEEDED'; end if;
  end if;

  update worker_ledger
  set reversed_at = now(), reversed_by = p_actor_id, reversal_reason = trim(p_reason)
  where id = v_original.id
  returning * into v_original;

  if v_original.transaction_type = 'salary_paid' then
    perform refresh_salary_payment_from_ledger(
      p_tenant_id,
      v_original.linked_salary_period_id,
      v_original.worker_id,
      p_actor_id
    );
  end if;

  return v_original;
end;
$$;

create or replace function worker_money_summaries(p_tenant_id uuid)
returns table (
  worker_id uuid,
  advance_balance numeric,
  loan_balance numeric,
  salary_paid numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id as worker_id,
    greatest(coalesce(sum(
      case
        when l.transaction_type = 'advance_given' then l.amount
        when l.transaction_type in ('deduction', 'repayment') and l.balance_account = 'advance' then -l.amount
        else 0
      end
    ), 0), 0)::numeric as advance_balance,
    greatest(coalesce(sum(
      case
        when l.transaction_type = 'loan_given' then l.amount
        when l.transaction_type in ('deduction', 'repayment') and l.balance_account = 'loan' then -l.amount
        else 0
      end
    ), 0), 0)::numeric as loan_balance,
    coalesce(sum(
      case when l.transaction_type = 'salary_paid' then l.amount else 0 end
    ), 0)::numeric as salary_paid
  from workers w
  left join worker_ledger l
    on l.worker_id = w.id
    and l.tenant_id = p_tenant_id
    and l.deleted_at is null
    and l.reversed_at is null
  where w.tenant_id = p_tenant_id
    and w.deleted_at is null
  group by w.id;
$$;

revoke all on function worker_money_balance(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function refresh_salary_payment_from_ledger(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function record_worker_money_entry(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function correct_worker_money_entry(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function reverse_worker_money_entry(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function worker_money_summaries(uuid) from public, anon, authenticated;

grant execute on function worker_money_balance(uuid, uuid, text, uuid) to service_role;
grant execute on function refresh_salary_payment_from_ledger(uuid, uuid, uuid, text) to service_role;
grant execute on function record_worker_money_entry(uuid, uuid, worker_ledger_transaction_type, numeric, date, text, uuid, uuid, text, text, uuid) to service_role;
grant execute on function correct_worker_money_entry(uuid, uuid, numeric, date, text, uuid, text, text, text, uuid) to service_role;
grant execute on function reverse_worker_money_entry(uuid, uuid, text, text) to service_role;
grant execute on function worker_money_summaries(uuid) to service_role;

comment on column worker_ledger.balance_account is 'Advance or loan account reduced by repayment/deduction; legacy unallocated rows remain null.';
comment on column worker_ledger.idempotency_key is 'Tenant-scoped command key preventing duplicate financial entries.';
comment on column worker_ledger.corrected_from_entry_id is 'Original preserved entry replaced by this audited correction.';
comment on column worker_ledger.reversed_at is 'Timestamp at which this historical entry stopped affecting balances and reports.';
