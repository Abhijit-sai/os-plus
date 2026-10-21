-- CH-2 only: tenant-owned memory and silent turns. No existing business tables changed.
begin;
create table public.chat_conversations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 channel_id uuid not null, chatwoot_conversation_id bigint not null check(chatwoot_conversation_id>0),
 chatwoot_contact_id bigint not null check(chatwoot_contact_id>0),
 status text not null check(status in ('open','pending','resolved','snoozed')),
 status_at timestamptz not null, quiet_until timestamptz, last_customer_at timestamptz, last_staff_at timestamptz, last_bot_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,channel_id,chatwoot_conversation_id),
 foreign key(tenant_id,channel_id) references public.chat_channels(tenant_id,id)
);
-- contact_id and its FK arrive with the CH-3 contacts table.
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 conversation_id uuid not null, chatwoot_message_id bigint not null check(chatwoot_message_id>0),
 author text not null check(author in ('customer','staff','bot','system')), private boolean not null,
 content text check(length(content)<=150000), content_type text not null,
 attachments_json jsonb not null default '[]'::jsonb check(jsonb_typeof(attachments_json)='array'),
 transcript text, staff_chatwoot_user_id bigint, created_at timestamptz not null, captured_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,chatwoot_message_id), unique(tenant_id,conversation_id,id),
 foreign key(tenant_id,conversation_id) references public.chat_conversations(tenant_id,id),
 check((author='staff' and staff_chatwoot_user_id is not null and staff_chatwoot_user_id>0) or (author<>'staff' and staff_chatwoot_user_id is null))
);
create index chat_messages_history on public.chat_messages(tenant_id,conversation_id,created_at,id);
create table public.chat_state (
 tenant_id uuid not null references public.tenants(id) on delete cascade, conversation_id uuid not null,
 ledger_json jsonb not null default '{}'::jsonb check(jsonb_typeof(ledger_json)='object'),
 updated_at timestamptz not null default now(), primary key(tenant_id,conversation_id),
 foreign key(tenant_id,conversation_id) references public.chat_conversations(tenant_id,id)
);
create table public.chat_turns (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 conversation_id uuid not null, trigger_message_id uuid not null,
 engine text not null default 'osplus-v1', knowledge_pack_version integer,
 mode text not null check(mode in ('auto','draft','sandbox')),
 outcome text not null check(outcome in ('sent','drafted','silent','handoff','fallback','error')),
 understanding_json jsonb not null default '{}'::jsonb, decision_json jsonb not null default '{}'::jsonb,
 reply_text text, checks_json jsonb not null default '{}'::jsonb, models_json jsonb not null default '{}'::jsonb,
 cost_usd numeric not null default 0 check(cost_usd>=0), timings_ms_json jsonb not null default '{}'::jsonb,
 error text, created_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,trigger_message_id),
 foreign key(tenant_id,conversation_id,trigger_message_id) references public.chat_messages(tenant_id,conversation_id,id)
);
create index chat_turns_history on public.chat_turns(tenant_id,conversation_id,created_at);
do $$ declare t text; begin
 foreach t in array array['chat_conversations','chat_messages','chat_state','chat_turns'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
 end loop;
end $$;
create trigger chat_conversations_updated before update on public.chat_conversations for each row execute function public.set_updated_at();
create trigger chat_state_updated before update on public.chat_state for each row execute function public.set_updated_at();

-- Service-only domain command. Rechecks authorization under locks after the response boundary.
create function public.chat_capture(p_context jsonb,p_kind text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid;
 w chat_workspaces%rowtype; c chat_channels%rowtype; existing chat_messages%rowtype;
 m jsonb:=p_input->'message'; conv uuid; msg uuid; turn_id uuid; moment timestamptz;
 quiet integer; inserted boolean:=false;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
 or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
 or p_kind is null or p_kind not in ('events','agent') then raise exception 'Invalid chat capture context'; end if;
 -- Share configuration's tenant lock before any rows: suspension/archive use a different row order.
 -- Also serializes provider message ids across conversations.
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants where id=t and status='active' for share;
 if not found then raise exception 'Chat access denied'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled for share;
 if not found then raise exception 'Chat access denied'; end if;
 select * into w from chat_workspaces where tenant_id=t and id=(p_input->>'workspaceId')::uuid
 and status='active' and webhook_secret_hash=p_input->>'secretHash' for share;
 if not found or w.chatwoot_account_id is distinct from (m->>'accountId')::bigint then raise exception 'Chat access denied'; end if;
 select * into c from chat_channels where tenant_id=t and id=(p_input->>'channelId')::uuid and workspace_id=w.id
 and chatwoot_inbox_id=(m->>'inboxId')::bigint and is_active for share;
 if not found or (m->>'channelKind' is not null and c.kind<>m->>'channelKind') then raise exception 'Chat channel unavailable'; end if;
 perform 1 from chat_brands where tenant_id=t and id=c.brand_id and is_active and deleted_at is null for share;
 if not found then raise exception 'Chat brand unavailable'; end if;
 if p_kind='agent' and (c.agent_mode='off' or m->>'author'<>'customer' or (m->>'private')::boolean) then
  return jsonb_build_object('outcome','ignored');
 end if;
 moment:=(m->>'createdAt')::timestamptz;
 if moment is null or moment>now()+interval '5 minutes' then raise exception 'Invalid chat event time'; end if;
 select * into existing from chat_messages where tenant_id=t and chatwoot_message_id=(m->>'messageId')::bigint;
 if found then
  -- Never move a provider message to another conversation on a duplicate delivery.
  perform 1 from chat_conversations where tenant_id=t and id=existing.conversation_id
   and channel_id=c.id and chatwoot_conversation_id=(m->>'conversationId')::bigint
   and chatwoot_contact_id=(m->>'contactId')::bigint;
  if not found then raise exception 'Chat message identity mismatch'; end if;
  conv:=existing.conversation_id; msg:=existing.id;
 else
  insert into chat_conversations(tenant_id,channel_id,chatwoot_conversation_id,chatwoot_contact_id,status,status_at)
  values(t,c.id,(m->>'conversationId')::bigint,(m->>'contactId')::bigint,m->>'status',moment)
  on conflict(tenant_id,channel_id,chatwoot_conversation_id) do update
   set status=case when excluded.status_at>=chat_conversations.status_at then excluded.status else chat_conversations.status end,
       status_at=greatest(chat_conversations.status_at,excluded.status_at)
   where chat_conversations.chatwoot_contact_id=excluded.chatwoot_contact_id
  returning id into conv;
  if conv is null then raise exception 'Chat conversation identity mismatch'; end if;
  insert into chat_messages(tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,attachments_json,staff_chatwoot_user_id,created_at)
  values(t,conv,(m->>'messageId')::bigint,m->>'author',(m->>'private')::boolean,m->>'content',m->>'contentType',m->'attachments',(m->>'staffUserId')::bigint,moment)
  returning id into msg;
  inserted:=true;
  insert into chat_state(tenant_id,conversation_id) values(t,conv) on conflict do nothing;
  if not (m->>'private')::boolean then
   select quiet_minutes into quiet from chat_settings where tenant_id=t;
   update chat_conversations set
    last_customer_at=case when m->>'author'='customer' then greatest(last_customer_at,moment) else last_customer_at end,
    last_staff_at=case when m->>'author'='staff' then greatest(last_staff_at,moment) else last_staff_at end,
    last_bot_at=case when m->>'author'='bot' then greatest(last_bot_at,moment) else last_bot_at end,
    quiet_until=case when m->>'author'='staff' then greatest(quiet_until,moment+make_interval(mins=>coalesce(quiet,60))) else quiet_until end
   where tenant_id=t and id=conv;
  end if;
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
  values(t,'chat.message.captured','chat_conversation',conv,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('messageId',msg));
 end if;
 -- Use the stored facts on replay: an altered duplicate cannot turn a staff note into an agent trigger.
 if p_kind='agent' and exists(select 1 from chat_messages where tenant_id=t and id=msg and author='customer' and not private) then
  insert into chat_turns(tenant_id,conversation_id,trigger_message_id,mode,outcome,decision_json)
  values(t,conv,msg,c.agent_mode,'silent','{"reason":"engine_not_enabled"}') on conflict(tenant_id,trigger_message_id) do nothing returning id into turn_id;
  if turn_id is not null then
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.turn.silent','chat_conversation',conv,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('turnId',turn_id));
  end if;
 end if;
 update chat_workspaces set last_event_at=now() where tenant_id=t and id=w.id;
 return jsonb_build_object('conversationId',conv,'messageId',msg,'inserted',inserted,'outcome',case when p_kind='agent' then 'silent' else 'captured' end);
end $$;
revoke all on function public.chat_capture(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_capture(jsonb,text,jsonb) to service_role;

-- Health codes are bounded; provider payloads and URL credentials never enter diagnostics.
create function public.chat_capture_issue(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; w uuid; code text:=p_input->>'code';
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
 or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
 or code is null or code not in ('unknown_inbox','capture_failed') then raise exception 'Invalid chat health context'; end if;
 update chat_workspaces set last_error=code,last_error_at=now()
 where tenant_id=t and id=(p_input->>'workspaceId')::uuid and webhook_secret_hash=p_input->>'secretHash'
 returning id into w;
 if w is null then raise exception 'Chat access denied'; end if;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.capture.issue','chat_workspace',w,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('code',code));
 return jsonb_build_object('recorded',true);
end $$;
revoke all on function public.chat_capture_issue(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_capture_issue(jsonb,jsonb) to service_role;

commit;
