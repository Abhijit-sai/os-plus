create type worker_ledger_transaction_type as enum (
  'advance_given',
  'loan_given',
  'deduction',
  'repayment',
  'adjustment',
  'salary_paid'
);

create type salary_period_status as enum ('draft', 'reviewed', 'finalized', 'paid');
create type salary_payment_status as enum ('unpaid', 'partially_paid', 'paid');

create table salary_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status salary_period_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint salary_periods_valid_range check (period_end >= period_start)
);

create table worker_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete restrict,
  transaction_type worker_ledger_transaction_type not null,
  amount numeric(12, 2) not null,
  transaction_date date not null default current_date,
  description text,
  linked_salary_period_id uuid references salary_periods(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint worker_ledger_amount_positive check (amount > 0)
);

create table salary_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  salary_period_id uuid not null references salary_periods(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete restrict,
  wage_type worker_wage_type not null,
  wage_amount numeric(12, 2) not null default 0,
  attendance_days numeric(8, 2) not null default 0,
  attendance_hours numeric(8, 2) not null default 0,
  productive_minutes integer not null default 0,
  gross_suggested_amount numeric(12, 2) not null default 0,
  advance_deduction numeric(12, 2) not null default 0,
  loan_deduction numeric(12, 2) not null default 0,
  other_deduction numeric(12, 2) not null default 0,
  repayment_credit numeric(12, 2) not null default 0,
  manual_adjustment numeric(12, 2) not null default 0,
  final_payable numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  payment_status salary_payment_status not null default 'unpaid',
  payment_date date,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint salary_calculations_amounts_non_negative check (
    wage_amount >= 0
    and attendance_days >= 0
    and attendance_hours >= 0
    and productive_minutes >= 0
    and gross_suggested_amount >= 0
    and advance_deduction >= 0
    and loan_deduction >= 0
    and other_deduction >= 0
    and repayment_credit >= 0
    and final_payable >= 0
    and amount_paid >= 0
  )
);

create trigger salary_periods_set_updated_at
before update on salary_periods
for each row
execute function set_updated_at();

create trigger worker_ledger_set_updated_at
before update on worker_ledger
for each row
execute function set_updated_at();

create trigger salary_calculations_set_updated_at
before update on salary_calculations
for each row
execute function set_updated_at();

create unique index salary_periods_tenant_range_active_idx on salary_periods(tenant_id, period_start, period_end) where deleted_at is null;

create unique index salary_calculations_tenant_period_worker_active_idx on salary_calculations(tenant_id, salary_period_id, worker_id) where deleted_at is null;

create index salary_periods_tenant_status_idx on salary_periods(tenant_id, status);
create index salary_periods_tenant_period_start_idx on salary_periods(tenant_id, period_start desc);
create index worker_ledger_tenant_worker_idx on worker_ledger(tenant_id, worker_id);
create index worker_ledger_tenant_transaction_date_idx on worker_ledger(tenant_id, transaction_date desc);
create index worker_ledger_tenant_type_idx on worker_ledger(tenant_id, transaction_type);
create index worker_ledger_tenant_salary_period_idx on worker_ledger(tenant_id, linked_salary_period_id);
create index salary_calculations_tenant_period_idx on salary_calculations(tenant_id, salary_period_id);
create index salary_calculations_tenant_worker_idx on salary_calculations(tenant_id, worker_id);
create index salary_calculations_tenant_payment_status_idx on salary_calculations(tenant_id, payment_status);

alter table salary_periods enable row level security;
alter table worker_ledger enable row level security;
alter table salary_calculations enable row level security;

comment on table salary_periods is 'Tenant-owned salary periods. Salary is system-suggested and admin-finalized.';
comment on table worker_ledger is 'Tenant-owned worker ledger for advances, loans, deductions, repayments, adjustments, and salary payments.';
comment on table salary_calculations is 'Tenant-owned salary suggestion snapshots generated from wage config, attendance, production work logs, and worker ledger entries.';
