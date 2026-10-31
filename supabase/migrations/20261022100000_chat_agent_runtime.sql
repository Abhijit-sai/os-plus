-- CH-5 local/mock-first runtime. No existing Boutique/Laundry table changes.
begin;
create table public.chat_sandbox_turns (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 brand_id uuid not null, actor_tenant_user_id uuid not null, command_key uuid not null, request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 correlation_id text not null check(length(correlation_id) between 1 and 200),
 result_json jsonb not null check(jsonb_typeof(result_json)='object' and octet_length(result_json::text)<=240000),
 created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,command_key),
 foreign key(tenant_id,brand_id) references public.chat_brands(tenant_id,id),
 foreign key(tenant_id,actor_tenant_user_id) references public.tenant_users(tenant_id,id)
);
alter table public.chat_sandbox_turns enable row level security;
revoke all on public.chat_sandbox_turns from public,anon,authenticated,service_role;
grant select on public.chat_sandbox_turns to service_role;
create index chat_sandbox_turns_recent on public.chat_sandbox_turns(tenant_id,created_at desc,id desc);
commit;

begin;
create table public.chat_agent_runs (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 conversation_id uuid not null,trigger_message_id uuid not null,turn_id uuid not null,channel_id uuid not null,pack_id uuid not null,
 pack_version integer not null check(pack_version>0),lease_token uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default now()+interval '2 minutes',
 status text not null default 'running' check(status in ('running','ready','delivering','delivered','uncertain','finished')),
 result_json jsonb,delivery_note_id bigint check(delivery_note_id>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,trigger_message_id),
 foreign key(tenant_id,conversation_id,trigger_message_id) references public.chat_messages(tenant_id,conversation_id,id),
 foreign key(tenant_id,turn_id) references public.chat_turns(tenant_id,id),
 foreign key(tenant_id,channel_id) references public.chat_channels(tenant_id,id),
 foreign key(tenant_id,pack_id) references public.chat_knowledge_packs(tenant_id,id),
 check(result_json is null or (jsonb_typeof(result_json)='object' and octet_length(result_json::text)<=240000))
);
create table public.chat_agent_cost_entries (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 run_id uuid not null,call_key text not null check(call_key in ('understand','classify','write','rewrite')),lease_token uuid not null,
 month_start date not null default date_trunc('month',timezone('UTC',now()))::date,
 max_usd numeric(21,12) not null check(max_usd>0),actual_usd numeric(21,12) check(actual_usd>=0),
 state text not null default 'reserved' check(state in ('reserved','settled','uncertain')),
 generation_id text check(length(generation_id)<=200),
 created_at timestamptz not null default now(),settled_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,run_id,call_key),foreign key(tenant_id,run_id) references public.chat_agent_runs(tenant_id,id),
 check((state='settled')=(actual_usd is not null))
);
create index chat_agent_cost_month on public.chat_agent_cost_entries(tenant_id,month_start);
alter table public.chat_agent_runs enable row level security;
alter table public.chat_agent_cost_entries enable row level security;
revoke all on public.chat_agent_runs,public.chat_agent_cost_entries from public,anon,authenticated,service_role;
grant select on public.chat_agent_runs,public.chat_agent_cost_entries to service_role;
commit;
