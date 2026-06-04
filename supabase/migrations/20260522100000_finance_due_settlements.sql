alter table public.receivables_payables
  add column if not exists amount_settled numeric(12, 2) not null default 0,
  add column if not exists settled_at date;

alter table public.receivables_payables
  add constraint receivables_payables_amount_settled_non_negative
  check (amount_settled >= 0);

alter table public.receivables_payables
  add constraint receivables_payables_amount_settled_not_over_amount
  check (amount_settled <= amount);

comment on column public.receivables_payables.amount is
  'Original receivable/payable obligation amount.';

comment on column public.receivables_payables.amount_settled is
  'Cash received for receivables or cash paid for payables.';

comment on column public.receivables_payables.settled_at is
  'Date of the latest manual settlement amount entry.';
