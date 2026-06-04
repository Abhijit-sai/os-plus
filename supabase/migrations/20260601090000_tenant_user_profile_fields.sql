alter table public.tenant_users
add column if not exists display_name text,
add column if not exists email text,
add column if not exists updated_by text;

comment on column public.tenant_users.display_name is 'Optional tenant-facing label for the Clerk user membership.';
comment on column public.tenant_users.email is 'Optional tenant-facing email for identifying the Clerk user membership. Clerk remains the identity provider.';
