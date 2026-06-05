create type tenant_billing_payment_status as enum ('pending', 'partially_paid', 'paid', 'overdue', 'waived', 'cancelled');

create table tenant_billing_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  billing_period_start date not null,
  billing_period_end date not null,
  plan_name text not null,
  amount_due numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  payment_status tenant_billing_payment_status not null default 'pending',
  payment_date date,
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint tenant_billing_records_period_valid check (billing_period_end >= billing_period_start),
  constraint tenant_billing_records_amount_due_nonnegative check (amount_due >= 0),
  constraint tenant_billing_records_amount_paid_nonnegative check (amount_paid >= 0)
);

create trigger tenant_billing_records_set_updated_at
before update on tenant_billing_records
for each row
execute function set_updated_at();

create index tenant_billing_records_tenant_status_idx
on tenant_billing_records(tenant_id, payment_status)
where deleted_at is null;

create index tenant_billing_records_tenant_period_idx
on tenant_billing_records(tenant_id, billing_period_end desc)
where deleted_at is null;

alter table tenant_billing_records enable row level security;

comment on table tenant_billing_records is 'OS PLUS-owned tenant subscription/payment tracking records. Tenant users do not manage these records.';
