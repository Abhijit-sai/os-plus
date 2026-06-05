create type expense_input_gst_status as enum ('not_applicable', 'claimable', 'needs_review', 'not_claimed');

alter table public.expenses
add column if not exists vendor_gstin text,
add column if not exists vendor_invoice_number text,
add column if not exists vendor_invoice_date date,
add column if not exists gst_treatment gst_treatment not null default 'not_applicable',
add column if not exists gst_rate numeric(5, 2) not null default 0,
add column if not exists taxable_amount numeric(12, 2) not null default 0,
add column if not exists gst_amount numeric(12, 2) not null default 0,
add column if not exists input_gst_status expense_input_gst_status not null default 'not_applicable';

alter table public.expenses
drop constraint if exists expenses_gst_amounts_non_negative;

alter table public.expenses
add constraint expenses_gst_amounts_non_negative check (
  gst_rate >= 0
  and gst_rate <= 100
  and taxable_amount >= 0
  and gst_amount >= 0
);

create index if not exists expenses_tenant_gst_treatment_idx
on public.expenses(tenant_id, gst_treatment)
where deleted_at is null;

create index if not exists expenses_tenant_input_gst_status_idx
on public.expenses(tenant_id, input_gst_status)
where deleted_at is null;

comment on column public.expenses.vendor_gstin is 'Optional vendor GSTIN captured from the vendor invoice.';
comment on column public.expenses.vendor_invoice_number is 'Optional vendor invoice number used for accountant-handoff GST reports.';
comment on column public.expenses.vendor_invoice_date is 'Optional vendor invoice date used for accountant-handoff GST reports.';
comment on column public.expenses.gst_treatment is 'Expense-level GST treatment snapshot.';
comment on column public.expenses.gst_rate is 'Expense-level GST rate percentage used for calculated input GST.';
comment on column public.expenses.taxable_amount is 'Calculated taxable base for this expense, based on GST treatment.';
comment on column public.expenses.gst_amount is 'Calculated input GST amount for this expense.';
comment on column public.expenses.input_gst_status is 'Input GST review/claim state for accountant handoff.';
