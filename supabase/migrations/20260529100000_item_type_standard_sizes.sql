create table if not exists public.item_type_standard_sizes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_type_id uuid not null references public.item_types(id) on delete cascade,
  size_label text not null,
  measurement_data_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint item_type_standard_sizes_label_not_blank check (length(trim(size_label)) > 0),
  constraint item_type_standard_sizes_measurement_object check (jsonb_typeof(measurement_data_json) = 'object')
);

alter table public.order_items
  add column if not exists standard_size_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_standard_size_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_standard_size_id_fkey
      foreign key (standard_size_id)
      references public.item_type_standard_sizes(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists idx_item_type_standard_sizes_unique_active_label
  on public.item_type_standard_sizes(tenant_id, item_type_id, lower(size_label))
  where deleted_at is null;

create index if not exists idx_item_type_standard_sizes_tenant_item
  on public.item_type_standard_sizes(tenant_id, item_type_id, sort_order)
  where deleted_at is null;

create index if not exists idx_order_items_standard_size_id
  on public.order_items(standard_size_id)
  where deleted_at is null;

alter table public.item_type_measurement_fields enable row level security;
alter table public.item_type_standard_sizes enable row level security;

create trigger item_type_standard_sizes_set_updated_at
before update on public.item_type_standard_sizes
for each row
execute function set_updated_at();

comment on table public.item_type_standard_sizes is 'Tenant-owned item-type standard size templates such as XS, S, M, L. Each row stores a full measurement dimension set.';
comment on column public.order_items.standard_size_id is 'Optional tenant-scoped standard size template selected for this production item.';
