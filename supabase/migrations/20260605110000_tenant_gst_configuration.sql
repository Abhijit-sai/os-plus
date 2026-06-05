create type gst_treatment as enum ('taxable_exclusive', 'taxable_inclusive', 'exempt_or_nil', 'non_gst', 'not_applicable');

alter table tenants
add column legal_name text,
add column registered_address text,
add column gst_registered boolean not null default false,
add column gstin text,
add column default_sales_gst_rate numeric(5, 2) not null default 0,
add column default_purchase_gst_rate numeric(5, 2) not null default 0,
add column default_order_gst_treatment gst_treatment not null default 'not_applicable',
add column default_expense_gst_treatment gst_treatment not null default 'not_applicable',
add constraint tenants_gst_rates_nonnegative check (default_sales_gst_rate >= 0 and default_purchase_gst_rate >= 0),
add constraint tenants_gst_rates_max check (default_sales_gst_rate <= 100 and default_purchase_gst_rate <= 100),
add constraint tenants_gstin_format check (
  gstin is null
  or gstin ~* '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
);

create table tenant_gst_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  rate_percent numeric(5, 2) not null,
  is_default_sales boolean not null default false,
  is_default_purchase boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint tenant_gst_rates_rate_valid check (rate_percent >= 0 and rate_percent <= 100)
);

create trigger tenant_gst_rates_set_updated_at
before update on tenant_gst_rates
for each row
execute function set_updated_at();

create index tenant_gst_rates_tenant_active_idx
on tenant_gst_rates(tenant_id, is_active)
where deleted_at is null;

alter table tenant_gst_rates enable row level security;

comment on column tenants.gst_registered is 'Whether the tenant says they are GST registered. Used for reporting setup, not direct filing.';
comment on column tenants.gstin is 'Optional GSTIN captured for accountant-handoff reports. Direct filing/e-invoicing is later.';
comment on table tenant_gst_rates is 'Tenant-owned GST rate presets for order and expense GST capture.';
