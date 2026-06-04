create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_url text not null,
  file_type text,
  label text,
  notes text,
  is_customer_visible boolean not null default false,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint attachments_entity_type_check check (
    entity_type in ('customer', 'measurement', 'order', 'order_item', 'stage_instance', 'worker', 'expense')
  ),
  constraint attachments_file_url_not_blank check (length(trim(file_url)) > 0)
);

create index if not exists idx_attachments_tenant_entity
  on public.attachments(tenant_id, entity_type, entity_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_attachments_customer_visible
  on public.attachments(tenant_id, entity_type, entity_id)
  where deleted_at is null and is_customer_visible = true;

alter table public.attachments enable row level security;

create trigger attachments_set_updated_at
before update on public.attachments
for each row
execute function set_updated_at();

comment on table public.attachments is 'Tenant-owned file/link references for customers, measurements, orders, order items, workflow stages, workers, and expenses.';
comment on column public.attachments.is_customer_visible is 'Marks attachments that may be shown on safe customer-facing surfaces when those surfaces explicitly opt in.';
