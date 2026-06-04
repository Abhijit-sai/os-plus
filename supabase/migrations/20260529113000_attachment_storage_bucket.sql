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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'os-plus-attachments',
  'os-plus-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.attachments
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint;

create index if not exists idx_attachments_storage_path
  on public.attachments(storage_bucket, storage_path)
  where deleted_at is null and storage_path is not null;

comment on column public.attachments.storage_bucket is 'Supabase Storage bucket for uploaded files.';
comment on column public.attachments.storage_path is 'Private Supabase Storage path for uploaded files. Access should go through authenticated download routes.';
comment on column public.attachments.file_size_bytes is 'Uploaded file size in bytes when known.';
