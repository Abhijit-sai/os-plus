begin;
create table chat_public_outbox(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 run_id uuid not null,conversation_id uuid not null,pack_id uuid not null,
 state text not null default 'sending' check(state in ('sending','sent','uncertain')),
 text text not null check(length(text) between 1 and 6000),provider_message_id bigint check(provider_message_id>0),
 created_at timestamptz not null default now(),sent_at timestamptz,latency_ms numeric check(latency_ms>=0),
 unique(tenant_id,id),unique(tenant_id,run_id),unique(tenant_id,provider_message_id),
 foreign key(tenant_id,run_id) references chat_agent_runs(tenant_id,id),
 foreign key(tenant_id,conversation_id) references chat_conversations(tenant_id,id),
 foreign key(tenant_id,pack_id) references chat_knowledge_packs(tenant_id,id),
 check((state='sent')=(sent_at is not null and provider_message_id is not null))
);
alter table chat_public_outbox enable row level security;
revoke all on chat_public_outbox from public,anon,authenticated,service_role;
grant select on chat_public_outbox to service_role;
create function chat_public_reply(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;loaded jsonb;result jsonb;r chat_agent_runs%rowtype;o chat_public_outbox%rowtype;cap jsonb:=p_input-'providerMessageId';moment timestamptz;
begin
 if p_action is null or p_action not in ('claim','target','record','uncertain') or jsonb_typeof(p_input) is distinct from 'object'
  or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','runId','leaseToken','providerMessageId']<>'{}'::jsonb then raise exception 'Invalid public delivery action'; end if;
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
  or p_context->>'source' is distinct from 'WEBHOOK' or nullif(p_context->>'correlationId','') is null then raise exception 'Invalid public delivery context'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid and conversation_id=(p_input->>'conversationId')::uuid
  and channel_id=(p_input->>'channelId')::uuid and trigger_message_id=(p_input->>'triggerMessageId')::uuid and lease_token=(p_input->>'leaseToken')::uuid for update;
 if not found then raise exception 'Public delivery lease unavailable'; end if;
 select * into o from chat_public_outbox where tenant_id=t and run_id=r.id for update;
 if p_action='claim' then
  loaded:=chat_agent_load(p_context,p_input-array['runId','leaseToken']);
  if o.id is not null then return jsonb_build_object('status',case when o.state='sending' then 'held' else o.state end);end if;
  if not exists(select 1 from chat_channels c join chat_channel_action_approvals a on a.tenant_id=t and a.channel_id=c.id
   join chat_knowledge_packs p on p.tenant_id=t and p.id=a.pack_id and p.status='published'
   join tenant_users u on u.tenant_id=t and u.id=a.approved_by and u.role='owner_admin' and u.status='active'
   where c.tenant_id=t and c.id=r.channel_id and c.agent_mode='auto' and c.is_active and a.pack_id=r.pack_id and a.approved_at is not null)
   then return jsonb_build_object('status','private');end if;
  result:=chat_agent_run(p_context,'delivery.claim',cap);
  if result->>'status'<>'delivering' then return result;end if;
  insert into chat_public_outbox(tenant_id,run_id,conversation_id,pack_id,text) values(t,r.id,r.conversation_id,r.pack_id,r.result_json->>'replyText') returning * into o;
  return jsonb_build_object('status','claimed','id',o.id,'replyText',o.text);
 end if;
 if o.id is null then raise exception 'Public outbox unavailable';end if;
 if p_action='target' then
  if o.state<>'sending' or not exists(select 1 from chat_channels c join chat_channel_action_approvals a on a.tenant_id=t and a.channel_id=c.id
   join chat_knowledge_packs p on p.tenant_id=t and p.id=a.pack_id and p.status='published'
   join tenant_users u on u.tenant_id=t and u.id=a.approved_by and u.role='owner_admin' and u.status='active'
   where c.tenant_id=t and c.id=r.channel_id and c.is_active and c.agent_mode='auto' and a.pack_id=r.pack_id and a.approved_at is not null)
   then raise exception 'Public approval changed';end if;
  -- Final capability validation also rechecks quiet time, latest customer message and current pack.
  return chat_agent_target(p_context,cap);
 end if;
 if p_action='uncertain' then
  if o.state='sent' then return jsonb_build_object('status','sent');end if;
  perform chat_agent_run(p_context,'delivery.uncertain',cap);
  update chat_public_outbox set state='uncertain',provider_message_id=coalesce((p_input->>'providerMessageId')::bigint,provider_message_id) where tenant_id=t and id=o.id;
  return jsonb_build_object('status','uncertain');
 end if;
 if o.state='sent' then
  if o.provider_message_id is distinct from (p_input->>'providerMessageId')::bigint then raise exception 'Public receipt changed';end if;
  return jsonb_build_object('status','sent');
 end if;
 if o.state<>'sending' then raise exception 'Uncertain public send requires reconciliation';end if;
 perform chat_agent_run(p_context,'delivery.record',cap||jsonb_build_object('providerNoteId',p_input->'providerMessageId'));
 moment:=clock_timestamp();
 update chat_public_outbox set state='sent',provider_message_id=(p_input->>'providerMessageId')::bigint,sent_at=moment,
  latency_ms=greatest(0,extract(epoch from moment-(select created_at from chat_messages where tenant_id=t and id=r.trigger_message_id))*1000)
  where tenant_id=t and id=o.id;
 update chat_turns set decision_json=decision_json||'{"delivery":"posted_public_auto"}'::jsonb,
  timings_ms_json=timings_ms_json||jsonb_build_object('customerToPublicReceipt',(select latency_ms from chat_public_outbox where tenant_id=t and id=o.id))
  where tenant_id=t and id=r.turn_id;
 return jsonb_build_object('status','sent');
end $$;
revoke all on function chat_public_reply(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_public_reply(jsonb,text,jsonb) to service_role;
commit;
