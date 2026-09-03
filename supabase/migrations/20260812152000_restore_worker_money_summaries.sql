-- Forward repair for shared environments that applied an earlier version of
-- 20260810100000 before worker_money_summaries was added to that migration.
-- Keep this separate because editing an already-recorded migration does not
-- replay its later additions in Supabase.

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

revoke all on function worker_money_summaries(uuid) from public, anon, authenticated, service_role;
grant execute on function worker_money_summaries(uuid) to service_role;

comment on function worker_money_summaries(uuid) is
  'Tenant-scoped worker advance, loan, and salary-paid balances for server-side salary and worker views.';

notify pgrst, 'reload schema';
