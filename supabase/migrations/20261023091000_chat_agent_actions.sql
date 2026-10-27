begin;
create table public.chat_agent_action_receipts(
 tenant_id uuid not null references tenants(id) on delete cascade,run_id uuid not null,created_at timestamptz not null default now(),
 primary key(tenant_id,run_id),foreign key(tenant_id,run_id) references chat_agent_runs(tenant_id,id)
);
alter table chat_agent_action_receipts enable row level security;
revoke all on chat_agent_action_receipts from public,anon,authenticated,service_role;
grant select on chat_agent_action_receipts to service_role;

-- Authenticated original run completion and provisional actions commit or roll back together.
-- No model observation can materialize a customer, callback task or pickup.
create function public.chat_action_agent_run(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid;result jsonb;run chat_agent_runs%rowtype;lead leads%rowtype;channel chat_channels%rowtype;
 pack chat_knowledge_packs%rowtype;request chat_action_requests%rowtype;u jsonb;signal jsonb;slot jsonb;details jsonb;
 msg chat_messages%rowtype;ctx jsonb;wanted jsonb;why text;field text;action text;
begin
 result:=chat_agent_run(p_context,p_action,p_input-'observedAssigneeId');
 if p_action='claim' and result ? 'context' then result:=jsonb_set(result,'{context,actions}',coalesce(chat_action_context(t,(p_input->>'conversationId')::uuid),'null'));end if;
 if p_action<>'complete' or result->>'status' not in ('ready','finished') then return result; end if;
 select * into run from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid and lease_token=(p_input->>'leaseToken')::uuid for update;
 if not found or run.result_json is null then return result; end if;
 insert into chat_agent_action_receipts(tenant_id,run_id) values(t,run.id) on conflict do nothing;
 if not found then return result; end if;
 select * into lead from leads where tenant_id=t and conversation_id=run.conversation_id and closed_at is null for update;
 if not found then return result; end if;
 select * into channel from chat_channels where tenant_id=t and id=run.channel_id and is_active for share;
 select * into pack from chat_knowledge_packs where tenant_id=t and id=run.pack_id and status='published' for share;
 if channel.id is null or pack.id is null then raise exception 'Action configuration changed'; end if;
 ctx:=p_context||jsonb_build_object('idempotencyKey','agent-action:'||run.id::text);
 u:=run.result_json->'understanding';
 if coalesce((run.result_json#>>'{decision,handoff}')::boolean,false) then
  why:=case when exists(select 1 from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='payment_claim') then 'payment_claim'
    when exists(select 1 from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='financial') then 'dues'
    when exists(select 1 from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='complaint') then 'complaint'
    when exists(select 1 from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='unreadable') then 'unreadable' else 'staff_requested' end;
  perform chat_handoff_upsert(ctx,lead.id,run.trigger_message_id,why,(p_input->>'observedAssigneeId')::bigint);
 end if;
 select * into request from chat_action_requests where tenant_id=t and lead_id=lead.id and status in ('requested','customer_confirmed','materialized') order by created_at desc,id desc limit 1 for update;
 if exists(select 1 from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='cancel') and request.id is not null then
  if request.status='materialized' then perform chat_handoff_upsert(ctx,lead.id,run.trigger_message_id,'operational_change',(p_input->>'observedAssigneeId')::bigint);
  else perform chat_request_store(ctx,'request.withdraw',jsonb_build_object('id',request.id,'version',request.version)); end if;
 elsif channel.can_book and pack.pack_json ? 'booking' then
  select x into signal from jsonb_array_elements(coalesce(u->'signals','[]')) x where x->>'kind'='booking' limit 1;
  if signal is not null then
   select * into msg from chat_messages where tenant_id=t and conversation_id=run.conversation_id and id=(signal->>'messageId')::uuid and author='customer' and not private;
   if not found or nullif(signal->>'quote','') is null or strpos(coalesce(msg.content,''),signal->>'quote')=0 then raise exception 'Booking lacks customer evidence'; end if;
   select coalesce(jsonb_agg(svc->>'key' order by svc->>'key'),'[]') into wanted from jsonb_array_elements(pack.pack_json->'services') svc
    where (u->'services') ? (svc->>'key') and exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=run.conversation_id and m.author='customer' and not m.private
     and m.created_at>=(run.result_json#>>'{ledger,sessionStartedAt}')::timestamptz
     and (strpos(lower(coalesce(m.content,'')),lower(svc->>'name'))>0 or exists(select 1 from jsonb_array_elements_text(coalesce(svc->'aliases','[]')) alias where strpos(lower(coalesce(m.content,'')),lower(alias))>0)));
   if request.id is not null and request.status<>'materialized' and request.capability=pack.pack_json#>>'{booking,capability}'
    and (jsonb_array_length(wanted)=0 or request.details_json->'services'='[]'::jsonb or request.details_json->'services'=wanted) then
    details:=request.details_json;action:='request.revise';
   else details:='{"name":null,"services":[],"area":null,"address":null,"date":null,"window":null,"timePreference":null}';action:='request.save';
   end if;
   if jsonb_array_length(wanted)>0 then details:=jsonb_set(details,'{services}',wanted); end if;
   for slot in select x from jsonb_array_elements(coalesce(u->'slots','[]')) x loop
    field:=case slot->>'key' when 'time' then 'timePreference' when 'preference' then 'timePreference' else slot->>'key' end;
    if field not in ('name','area','address','date','window','timePreference') then raise exception 'Unsupported request detail'; end if;
    perform 1 from chat_messages m where m.tenant_id=t and m.conversation_id=run.conversation_id and m.author='customer' and not m.private and m.id=(slot->>'messageId')::uuid
     and m.created_at>=(run.result_json#>>'{ledger,sessionStartedAt}')::timestamptz and strpos(coalesce(m.content,''),slot->>'quote')>0 and strpos(slot->>'quote',slot->>'value')>0;
    if not found or nullif(slot->>'value','') is null then raise exception 'Request detail lacks customer evidence'; end if;
    details:=jsonb_set(details,array[field],to_jsonb(slot->>'value'));
   end loop;
   perform chat_request_store(ctx,action,jsonb_build_object('leadId',lead.id,'id',request.id,'version',request.version,'capability',pack.pack_json#>>'{booking,capability}',
    'sourceMessageId',msg.id,'evidence',signal->>'quote','details',details));
  end if;
 end if;
 update chat_state set ledger_json=jsonb_set(ledger_json,'{requestOpen}',to_jsonb(exists(select 1 from chat_action_requests where tenant_id=t and conversation_id=run.conversation_id and status in ('requested','customer_confirmed'))))
  where tenant_id=t and conversation_id=run.conversation_id;
 return result;
end $$;
revoke all on function public.chat_action_agent_run(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_action_agent_run(jsonb,text,jsonb) to service_role;
create function public.chat_agent_routing(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;checked jsonb;result jsonb;
begin
 checked:=chat_agent_load(p_context,p_input);
 select jsonb_build_object('conversationId',v.chatwoot_conversation_id,'inboxId',c.chatwoot_inbox_id) into result
 from chat_conversations v join chat_channels c on c.tenant_id=t and c.id=v.channel_id
 where v.tenant_id=t and v.id=(p_input->>'conversationId')::uuid and c.id=(p_input->>'channelId')::uuid and c.workspace_id=(p_input->>'workspaceId')::uuid;
 if result is null then raise exception 'Routing unavailable';end if;
 return result;
end $$;
revoke all on function chat_agent_routing(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_agent_routing(jsonb,jsonb) to service_role;
commit;
