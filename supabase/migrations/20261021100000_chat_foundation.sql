-- CH-1 only. Additive, disabled by default; browser clients have no database identity.
begin;

create table public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  module_key text not null default 'chat_leads' check (module_key = 'chat_leads'),
  is_enabled boolean not null default false, enabled_at timestamptz, enabled_by text,
  config_json jsonb not null default '{}'::jsonb check (jsonb_typeof(config_json)='object'),
  unique (tenant_id, module_key)
);
create trigger tenant_modules_updated before update on public.tenant_modules for each row execute function public.set_updated_at();
alter table public.tenant_modules enable row level security;
revoke all on public.tenant_modules from public, anon, authenticated, service_role;
grant select on public.tenant_modules to service_role;

create table public.chat_brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  name text not null check (length(btrim(name)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  persona_name text not null check (length(btrim(persona_name)) between 1 and 160),
  languages text[] not null default array['en']::text[],
  reply_style_json jsonb not null default '{}'::jsonb check (jsonb_typeof(reply_style_json)='object'),
  review_url text, website_url text,
  is_active boolean not null default true, deleted_at timestamptz,
  unique (tenant_id, slug)
);
create trigger chat_brands_updated before update on public.chat_brands for each row execute function public.set_updated_at();
alter table public.chat_brands enable row level security;
revoke all on public.chat_brands from public, anon, authenticated, service_role;
grant select on public.chat_brands to service_role;

create table public.chat_brand_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  brand_id uuid not null, location_id uuid not null,
  map_url text, lat numeric check (lat between -90 and 90), lng numeric check (lng between -180 and 180),
  service_areas text[] not null default '{}', service_postal_codes text[] not null default '{}',
  hours_json jsonb not null default '{}'::jsonb check (jsonb_typeof(hours_json)='object'),
  is_primary boolean not null default false, sort_order integer not null default 0,
  unique (tenant_id, brand_id, location_id),
  foreign key (tenant_id, brand_id) references public.chat_brands(tenant_id,id),
  foreign key (tenant_id, location_id) references public.tenant_locations(tenant_id,id)
);
create trigger chat_brand_locations_updated before update on public.chat_brand_locations for each row execute function public.set_updated_at();
alter table public.chat_brand_locations enable row level security;
revoke all on public.chat_brand_locations from public, anon, authenticated, service_role;
grant select on public.chat_brand_locations to service_role;

create table public.chat_knowledge_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  brand_id uuid not null, version integer not null check (version>0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  pack_json jsonb not null check (jsonb_typeof(pack_json)='object' and octet_length(pack_json::text)<=262144 and pack_json->>'schemaVersion'='1'),
  published_at timestamptz, published_by text,
  unique(tenant_id,brand_id,version),
  foreign key(tenant_id,brand_id) references public.chat_brands(tenant_id,id)
);
create trigger chat_knowledge_packs_updated before update on public.chat_knowledge_packs for each row execute function public.set_updated_at();
alter table public.chat_knowledge_packs enable row level security;
revoke all on public.chat_knowledge_packs from public, anon, authenticated, service_role;
grant select on public.chat_knowledge_packs to service_role;

create table public.chat_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  unique(tenant_id),
  chatwoot_base_url text not null check (chatwoot_base_url ~ '^https://[^/@?#]+$'),
  chatwoot_account_id bigint check (chatwoot_account_id>0),
  workspace_key text not null unique check (workspace_key ~ '^[a-zA-Z0-9_-]{32,128}$'),
  webhook_secret_hash text not null check (webhook_secret_hash ~ '^[a-f0-9]{64}$'),
  api_token_enc text check (api_token_enc ~ '^gcm1\.v[0-9]+\.'),
  bot_token_enc text check (bot_token_enc ~ '^gcm1\.v[0-9]+\.'),
  agent_bot_id bigint check (agent_bot_id>0),
  status text not null default 'pending' check(status in ('pending','active','suspended')),
  provisioning_key uuid not null default gen_random_uuid(), provisioning_attempted_at timestamptz,
  last_event_at timestamptz, last_error text, last_error_at timestamptz,
  unique(chatwoot_base_url,chatwoot_account_id),
  check (status<>'active' or (chatwoot_account_id is not null and api_token_enc is not null))
);
create trigger chat_workspaces_updated before update on public.chat_workspaces for each row execute function public.set_updated_at();
alter table public.chat_workspaces enable row level security;
revoke all on public.chat_workspaces from public, anon, authenticated, service_role;
grant select on public.chat_workspaces to service_role;

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  workspace_id uuid not null, brand_id uuid not null, default_location_id uuid,
  chatwoot_inbox_id bigint not null check (chatwoot_inbox_id>0),
  kind text not null check(kind in ('whatsapp','instagram','facebook','website')),
  name text not null check(length(btrim(name)) between 1 and 160),
  agent_mode text not null default 'draft' check(agent_mode in ('off','draft','auto')),
  can_book boolean not null default false, can_share_statement boolean not null default false,
  whatsapp_number_e164 text check (whatsapp_number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  is_active boolean not null default true,
  unique(tenant_id,workspace_id,chatwoot_inbox_id),
  foreign key(tenant_id,workspace_id) references public.chat_workspaces(tenant_id,id),
  foreign key(tenant_id,brand_id) references public.chat_brands(tenant_id,id),
  foreign key(tenant_id,brand_id,default_location_id) references public.chat_brand_locations(tenant_id,brand_id,location_id)
);
create trigger chat_channels_updated before update on public.chat_channels for each row execute function public.set_updated_at();
alter table public.chat_channels enable row level security;
revoke all on public.chat_channels from public, anon, authenticated, service_role;
grant select on public.chat_channels to service_role;

create table public.chat_staff_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  tenant_user_id uuid not null, chatwoot_user_id bigint not null check(chatwoot_user_id>0),
  unique(tenant_id,tenant_user_id), unique(tenant_id,chatwoot_user_id),
  foreign key(tenant_id,tenant_user_id) references public.tenant_users(tenant_id,id)
);
create trigger chat_staff_links_updated before update on public.chat_staff_links for each row execute function public.set_updated_at();
alter table public.chat_staff_links enable row level security;
revoke all on public.chat_staff_links from public, anon, authenticated, service_role;
grant select on public.chat_staff_links to service_role;

create table public.chat_notification_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  kind text not null default 'telegram' check(kind='telegram'), label text not null,
  telegram_chat_id text, events text[] not null default '{}',
  link_code_hash text, link_code_expires_at timestamptz, linked_at timestamptz,
  is_active boolean not null default false
);
create trigger chat_notification_targets_updated before update on public.chat_notification_targets for each row execute function public.set_updated_at();
alter table public.chat_notification_targets enable row level security;
revoke all on public.chat_notification_targets from public, anon, authenticated, service_role;
grant select on public.chat_notification_targets to service_role;

create table public.chat_notification_target_brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  target_id uuid not null, brand_id uuid not null, unique(tenant_id,target_id,brand_id),
  foreign key(tenant_id,target_id) references public.chat_notification_targets(tenant_id,id),
  foreign key(tenant_id,brand_id) references public.chat_brands(tenant_id,id)
);
create trigger chat_notification_target_brands_updated before update on public.chat_notification_target_brands for each row execute function public.set_updated_at();
alter table public.chat_notification_target_brands enable row level security;
revoke all on public.chat_notification_target_brands from public, anon, authenticated, service_role;
grant select on public.chat_notification_target_brands to service_role;

create table public.chat_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  unique(tenant_id), timezone text not null default 'Asia/Kolkata',
  summary_local_time time not null default '21:30', quiet_minutes integer not null default 60 check(quiet_minutes between 1 and 10080),
  lost_after_days integer not null default 7 check(lost_after_days between 1 and 365),
  hot_hours integer not null default 24 check(hot_hours between 1 and 720),
  monthly_budget_usd numeric check(monthly_budget_usd>=0),
  budget_action text not null default 'draft_only' check(budget_action='draft_only'),
  default_currency text not null default 'INR' check(default_currency ~ '^[A-Z]{3}$')
);
create trigger chat_settings_updated before update on public.chat_settings for each row execute function public.set_updated_at();
alter table public.chat_settings enable row level security;
revoke all on public.chat_settings from public, anon, authenticated, service_role;
grant select on public.chat_settings to service_role;

create table public.chat_role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  role text not null check(role in ('viewer','finance')),
  permission text not null check(permission in ('leads:view','leads:pii')),
  allowed boolean not null default false, unique(tenant_id,role,permission)
);
create trigger chat_role_permissions_updated before update on public.chat_role_permissions for each row execute function public.set_updated_at();
alter table public.chat_role_permissions enable row level security;
revoke all on public.chat_role_permissions from public, anon, authenticated, service_role;
grant select on public.chat_role_permissions to service_role;

create table public.chat_summary_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text,
  unique (tenant_id, id),
  local_date date not null, sent_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb check(jsonb_typeof(payload_json)='object'),
  unique(tenant_id,local_date)
);
create trigger chat_summary_runs_updated before update on public.chat_summary_runs for each row execute function public.set_updated_at();
alter table public.chat_summary_runs enable row level security;
revoke all on public.chat_summary_runs from public, anon, authenticated, service_role;
grant select on public.chat_summary_runs to service_role;

create unique index chat_brand_primary_location on public.chat_brand_locations(tenant_id,brand_id) where is_primary;

create unique index chat_one_published_pack on public.chat_knowledge_packs(tenant_id,brand_id) where status='published';
create function public.chat_guard_knowledge_revision() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then raise exception 'Knowledge revisions are immutable'; end if;
 if (to_jsonb(new)-array['status','published_at','published_by','updated_at','updated_by']) is distinct from
    (to_jsonb(old)-array['status','published_at','published_by','updated_at','updated_by']) or
    not ((old.status='draft' and new.status='published') or (old.status='published' and new.status='archived')) or
    (old.status='published' and (new.published_at is distinct from old.published_at or new.published_by is distinct from old.published_by))
 then raise exception 'Knowledge revisions are immutable'; end if;
 return new;
end;
$$;
create trigger chat_pack_immutable before update or delete on public.chat_knowledge_packs for each row execute function public.chat_guard_knowledge_revision();

commit;
