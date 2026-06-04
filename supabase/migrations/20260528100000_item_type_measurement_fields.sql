create table if not exists public.item_type_measurement_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_type_id uuid not null references public.item_types(id) on delete cascade,
  field_key text not null,
  field_label text not null,
  unit text,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  help_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint item_type_measurement_fields_field_key_not_blank check (length(trim(field_key)) > 0),
  constraint item_type_measurement_fields_field_label_not_blank check (length(trim(field_label)) > 0)
);

create unique index if not exists idx_item_type_measurement_fields_unique_active_key
  on public.item_type_measurement_fields(tenant_id, item_type_id, lower(field_key))
  where deleted_at is null;

create index if not exists idx_item_type_measurement_fields_tenant_item
  on public.item_type_measurement_fields(tenant_id, item_type_id, sort_order)
  where deleted_at is null;
