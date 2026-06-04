create extension if not exists "pgcrypto";

create type tenant_status as enum ('active', 'inactive', 'suspended');
create type tenant_user_role as enum ('owner_admin', 'manager', 'finance', 'viewer');
create type tenant_user_status as enum ('active', 'invited', 'disabled');

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  store_name text not null,
  logo_url text,
  brand_color text,
  status tenant_status not null default 'active',
  custom_domain text,
  tracking_subdomain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint tenants_brand_color_format check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$')
);

create trigger tenants_set_updated_at
before update on tenants
for each row
execute function set_updated_at();

create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  clerk_user_id text not null,
  role tenant_user_role not null default 'viewer',
  status tenant_user_status not null default 'invited',
  invited_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, clerk_user_id)
);

create trigger tenant_users_set_updated_at
before update on tenant_users
for each row
execute function set_updated_at();

create index tenants_status_idx on tenants(status);
create index tenant_users_clerk_user_id_idx on tenant_users(clerk_user_id);
create index tenant_users_tenant_id_idx on tenant_users(tenant_id);
create index tenant_users_tenant_status_idx on tenant_users(tenant_id, status);

alter table tenants enable row level security;
alter table tenant_users enable row level security;

comment on table tenants is 'SaaS tenant root table. Not tenant-owned, but all tenant-owned records reference this table.';
comment on table tenant_users is 'Tenant-owned Clerk identity memberships and OS PLUS roles. All access must be tenant-scoped.';
