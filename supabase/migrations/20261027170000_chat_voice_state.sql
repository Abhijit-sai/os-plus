begin;
-- Additive Chat-owned state. Original customer messages and platform tables stay intact.
alter table chat_settings add column voice_enabled boolean not null default false,
 add column voice_max_bytes integer not null default 10000000 check(voice_max_bytes between 1024 and 10000000),
 add column voice_max_seconds integer not null default 120 check(voice_max_seconds between 1 and 120),
 add column voice_version integer not null default 1 check(voice_version>0);
alter table chat_agent_runs add constraint chat_agent_runs_voice_scope unique(tenant_id,id,conversation_id,trigger_message_id);
create table chat_voice_jobs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id),conversation_id uuid not null,trigger_message_id uuid not null,run_id uuid not null,
 attachment_id bigint not null check(attachment_id>0),state text not null default 'processing' check(state in ('processing','ready','unreadable','cancelled','uncertain')),
 note_state text not null default 'none' check(note_state in ('none','pending','sending','sent','uncertain')),
 settings_version integer not null check(settings_version>0),data_bytes integer check(data_bytes between 1 and 10000000),
 sha256 text check(sha256~'^[a-f0-9]{64}$'),duration_ms numeric check(duration_ms>0 and duration_ms<=120000),language text check(length(language) between 2 and 40),
 provider_note_id bigint check(provider_note_id>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,trigger_message_id),unique(tenant_id,run_id),
 foreign key(tenant_id,conversation_id,trigger_message_id) references chat_messages(tenant_id,conversation_id,id),
 foreign key(tenant_id,run_id,conversation_id,trigger_message_id) references chat_agent_runs(tenant_id,id,conversation_id,trigger_message_id),
 check((note_state='sent')=(provider_note_id is not null))
);
alter table chat_voice_jobs enable row level security;
revoke all on chat_voice_jobs from public,anon,authenticated,service_role;
grant select on chat_voice_jobs to service_role;
alter table chat_agent_cost_entries drop constraint chat_agent_cost_entries_call_key_check;
alter table chat_agent_cost_entries add constraint chat_agent_cost_entries_call_key_check check(call_key in ('understand','classify','write','rewrite','transcribe'));
commit;
