create type receivable_payable_type as enum ('receivable', 'payable');
create type receivable_payable_status as enum ('open', 'partially_paid', 'paid', 'cancelled', 'overdue');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  expense_date date not null default current_date,
  category_id uuid references expense_categories(id) on delete set null,
  amount numeric(12, 2) not null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  paid_to text,
  description text,
  receipt_url text,
  is_recurring boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_amount_positive check (amount > 0)
);

create table receivables_payables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type receivable_payable_type not null,
  party_name text not null,
  amount numeric(12, 2) not null,
  due_date date,
  status receivable_payable_status not null default 'open',
  description text,
  linked_order_id uuid references orders(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint receivables_payables_amount_positive check (amount > 0),
  constraint receivables_payables_party_name_not_blank check (length(btrim(party_name)) > 0)
);

create trigger expenses_set_updated_at
before update on expenses
for each row
execute function set_updated_at();

create trigger receivables_payables_set_updated_at
before update on receivables_payables
for each row
execute function set_updated_at();

create index expenses_tenant_expense_date_idx on expenses(tenant_id, expense_date desc);
create index expenses_tenant_category_idx on expenses(tenant_id, category_id);
create index expenses_tenant_payment_mode_idx on expenses(tenant_id, payment_mode_id);
create index receivables_payables_tenant_due_date_idx on receivables_payables(tenant_id, due_date);
create index receivables_payables_tenant_type_idx on receivables_payables(tenant_id, type);
create index receivables_payables_tenant_status_idx on receivables_payables(tenant_id, status);
create index receivables_payables_tenant_order_idx on receivables_payables(tenant_id, linked_order_id);

alter table expenses enable row level security;
alter table receivables_payables enable row level security;

comment on table expenses is 'Tenant-owned operational expenses. MVP finance remains operational tracking, not accounting or GST.';
comment on table receivables_payables is 'Tenant-owned operational receivables and payables with optional order linkage.';
