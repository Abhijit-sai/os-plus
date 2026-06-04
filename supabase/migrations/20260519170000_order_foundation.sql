create type order_source as enum ('walk_in', 'shopify_manual', 'whatsapp', 'other');
create type delivery_type as enum ('store_pickup', 'self_delivery', 'courier');
create type payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type order_status as enum ('confirmed', 'in_progress', 'ready', 'partially_delivered', 'completed', 'cancelled');
create type item_status as enum (
  'not_started',
  'in_production',
  'blocked',
  'completed',
  'ready_for_pickup',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'cancelled'
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_number text not null,
  source order_source not null default 'walk_in',
  customer_id uuid not null references customers(id) on delete restrict,
  order_date date not null default current_date,
  promised_delivery_date date,
  delivery_type delivery_type not null default 'store_pickup',
  delivery_address text,
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  payment_status payment_status not null default 'unpaid',
  order_status order_status not null default 'confirmed',
  notes text,
  tracking_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint orders_order_number_not_blank check (length(btrim(order_number)) > 0),
  constraint orders_amounts_non_negative check (
    subtotal >= 0 and discount_amount >= 0 and total_amount >= 0 and amount_paid >= 0
  )
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  item_type_id uuid not null references item_types(id) on delete restrict,
  name text not null,
  description text,
  color text,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  final_price numeric(12, 2) not null default 0,
  workflow_id uuid not null references workflows(id) on delete restrict,
  expected_completion_date date,
  delivery_type_override delivery_type,
  item_status item_status not null default 'not_started',
  customer_status_id uuid references customer_statuses(id) on delete set null,
  is_customer_visible boolean not null default true,
  final_photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint order_items_name_not_blank check (length(btrim(name)) > 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_amounts_non_negative check (unit_price >= 0 and discount_amount >= 0 and final_price >= 0)
);

create table order_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(12, 2) not null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  payment_account text,
  payment_date date not null default current_date,
  reference_number text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint order_payments_amount_positive check (amount > 0)
);

create trigger orders_set_updated_at
before update on orders
for each row
execute function set_updated_at();

create trigger order_items_set_updated_at
before update on order_items
for each row
execute function set_updated_at();

create trigger order_payments_set_updated_at
before update on order_payments
for each row
execute function set_updated_at();

create unique index orders_tenant_order_number_active_idx
on orders(tenant_id, lower(order_number))
where deleted_at is null;

create unique index orders_tracking_token_idx on orders(tracking_token);

create index orders_tenant_created_at_idx on orders(tenant_id, created_at desc);
create index orders_tenant_customer_idx on orders(tenant_id, customer_id);
create index orders_tenant_promised_delivery_idx on orders(tenant_id, promised_delivery_date);
create index orders_tenant_payment_status_idx on orders(tenant_id, payment_status);
create index orders_tenant_order_status_idx on orders(tenant_id, order_status);
create index order_items_tenant_order_idx on order_items(tenant_id, order_id);
create index order_items_tenant_item_type_idx on order_items(tenant_id, item_type_id);
create index order_items_tenant_workflow_idx on order_items(tenant_id, workflow_id);
create index order_items_tenant_expected_completion_idx on order_items(tenant_id, expected_completion_date);
create index order_items_tenant_status_idx on order_items(tenant_id, item_status);
create index order_payments_tenant_order_idx on order_payments(tenant_id, order_id);
create index order_payments_tenant_payment_date_idx on order_payments(tenant_id, payment_date);

alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_payments enable row level security;

comment on table orders is 'Tenant-owned commercial orders. Order is the commercial unit and owns tracking token.';
comment on table order_items is 'Tenant-owned production units inside orders. Workflow is selected at item level.';
comment on table order_payments is 'Tenant-owned payment records supporting partial payments.';
