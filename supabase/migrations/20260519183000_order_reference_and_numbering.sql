create table tenant_order_counters (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  last_order_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_order_counters_last_order_number_non_negative check (last_order_number >= 0)
);

create trigger tenant_order_counters_set_updated_at
before update on tenant_order_counters
for each row
execute function set_updated_at();

insert into tenant_order_counters (tenant_id, last_order_number)
select tenants.id, count(orders.id)::integer
from tenants
left join orders
  on orders.tenant_id = tenants.id
  and orders.deleted_at is null
group by tenants.id
on conflict (tenant_id) do nothing;

alter table orders
add column reference_order_id text;

create unique index orders_tenant_source_reference_active_idx
on orders(tenant_id, source, lower(reference_order_id))
where reference_order_id is not null and deleted_at is null;

create index orders_tenant_reference_order_id_idx
on orders(tenant_id, reference_order_id)
where reference_order_id is not null and deleted_at is null;

create or replace function generate_tenant_order_number(p_tenant_id uuid)
returns text as $$
declare
  next_number integer;
begin
  insert into tenant_order_counters (tenant_id, last_order_number)
  values (p_tenant_id, 0)
  on conflict (tenant_id) do nothing;

  update tenant_order_counters
  set last_order_number = last_order_number + 1
  where tenant_id = p_tenant_id
  returning last_order_number into next_number;

  return 'ORD-' || lpad(next_number::text, 6, '0');
end;
$$ language plpgsql;

create or replace function set_order_number()
returns trigger as $$
begin
  if new.order_number is null or length(btrim(new.order_number)) = 0 then
    new.order_number = generate_tenant_order_number(new.tenant_id);
  end if;

  return new;
end;
$$ language plpgsql;

create trigger orders_set_order_number
before insert on orders
for each row
execute function set_order_number();

alter table tenant_order_counters enable row level security;

comment on table tenant_order_counters is 'Tenant-owned order numbering counter. Used to generate tenant-scoped human-facing order numbers.';
comment on column orders.order_number is 'OS PLUS generated tenant-scoped human-facing order number. Primary key remains orders.id.';
comment on column orders.reference_order_id is 'Optional external/ecommerce/legacy order ID used to map orders from outside OS PLUS.';
