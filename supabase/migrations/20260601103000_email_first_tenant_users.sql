alter table public.tenant_users
alter column clerk_user_id drop not null;

create unique index if not exists tenant_users_tenant_email_active_idx
on public.tenant_users(tenant_id, lower(email))
where email is not null and status <> 'disabled';

comment on column public.tenant_users.clerk_user_id is 'Linked Clerk user ID after the invited email signs in. Tenant owners should not enter this manually.';
