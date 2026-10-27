begin;
-- Tenant-scoped operational incidents go only to the platform operator, never a tenant target.
create table chat_platform_alert_attempts(
 id uuid primary key,tenant_id uuid not null references tenants(id) on delete cascade,
 slot_hour timestamptz not null,recipient_enc text not null check(recipient_enc ~ '^gcm1[.]'),
 claim_token uuid not null default gen_random_uuid(),state text not null default 'sending' check(state in ('sending','sent','uncertain')),
 created_at timestamptz not null default now(),sent_at timestamptz,provider_message_id bigint check(provider_message_id>0),
 unique(tenant_id,id),unique(tenant_id,slot_hour),
 check(state<>'sent' or (sent_at is not null and provider_message_id is not null))
);
alter table chat_platform_alert_attempts enable row level security;
revoke all on chat_platform_alert_attempts from public,anon,authenticated,service_role;
grant select on chat_platform_alert_attempts to service_role;
create function chat_platform_alert(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;r chat_platform_alert_attempts%rowtype;
begin
 if p_context#>>'{actor,type}' is distinct from 'SYSTEM' or p_context#>>'{actor,id}' is distinct from 'chat-notifications'
  or p_context->>'source' is distinct from 'AUTOMATION' or nullif(btrim(p_context->>'correlationId'),'') is null
  or p_action is null or p_action not in ('claim','record','uncertain') then raise exception 'Invalid operator alert context';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 if p_action='claim' then
  perform 1 from tenants a join tenant_modules m on m.tenant_id=a.id and m.module_key='chat_leads' and m.is_enabled
   join chat_settings s on s.tenant_id=a.id and s.notifications_enabled where a.id=t and a.status='active' for share of a,m,s;
  if not found then return jsonb_build_object('status','none');end if;
  if p_input->>'recipientEnc' is null or p_input->>'recipientEnc' !~ '^gcm1[.]' or length(p_input->>'recipientEnc')>12000 then raise exception 'Invalid operator destination';end if;
  insert into chat_platform_alert_attempts(id,tenant_id,slot_hour,recipient_enc)
   values((p_input->>'id')::uuid,t,date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC',p_input->>'recipientEnc')
   on conflict(tenant_id,slot_hour) do nothing returning * into r;
  if not found then return jsonb_build_object('status','none');end if;
 else
  select * into r from chat_platform_alert_attempts where tenant_id=t and id=(p_input->>'id')::uuid and claim_token=(p_input->>'token')::uuid for update;
  if not found then raise exception 'Operator alert claim unavailable';end if;
  if r.state='sent' then return jsonb_build_object('status','sent');end if;
  if p_action='record' and (p_input->>'messageId' is null or (p_input->>'messageId')::numeric not between 1 and 9007199254740991
   or (p_input->>'messageId')::numeric<>trunc((p_input->>'messageId')::numeric)) then raise exception 'Invalid operator receipt';end if;
  update chat_platform_alert_attempts set state=case when p_action='record' then 'sent' else 'uncertain' end,
   sent_at=case when p_action='record' then now() else null end,
   provider_message_id=case when p_action='record' then (p_input->>'messageId')::bigint else null end
   where tenant_id=t and id=r.id returning * into r;
 end if;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.platform_alert.'||case when p_action='claim' then 'claimed' else r.state end,'chat_platform_alert',r.id,
  'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId','{}');
 return case when p_action='claim' then jsonb_build_object('status','claimed','id',r.id,'token',r.claim_token,'recipientEnc',r.recipient_enc)
  else jsonb_build_object('status',r.state) end;
end $$;
revoke all on function chat_platform_alert(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_platform_alert(jsonb,text,jsonb) to service_role;
commit;
