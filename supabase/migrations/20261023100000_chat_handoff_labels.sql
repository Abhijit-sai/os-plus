begin;
create table chat_handoff_labels(
 tenant_id uuid not null references tenants(id) on delete cascade,conversation_id uuid not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','uncertain')),created_at timestamptz not null default now(),sent_at timestamptz,
 primary key(tenant_id,conversation_id),foreign key(tenant_id,conversation_id) references chat_conversations(tenant_id,id)
);
alter table chat_handoff_labels enable row level security;
revoke all on chat_handoff_labels from public,anon,authenticated,service_role;
grant select on chat_handoff_labels to service_role;
create function chat_handoff_label_intent() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.kind='handoff.recorded' then
  insert into chat_handoff_labels(tenant_id,conversation_id) select new.tenant_id,conversation_id from leads where tenant_id=new.tenant_id and id=new.lead_id on conflict do nothing;
 end if;return new;
end $$;
revoke all on function chat_handoff_label_intent() from public,anon,authenticated,service_role;
create trigger chat_handoff_label_intent after insert on lead_events for each row execute function chat_handoff_label_intent();
create function chat_handoff_label(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;checked jsonb;r chat_handoff_labels%rowtype;v chat_conversations%rowtype;c chat_channels%rowtype;
begin
 if p_context#>>'{actor,type}'='USER' then
  perform chat_lead_authorize(p_context);
  select cv.* into v from chat_conversations cv join leads l on l.tenant_id=t and l.conversation_id=cv.id
   where cv.tenant_id=t and (l.id=(p_input->>'leadId')::uuid or exists(select 1 from chat_action_requests where tenant_id=t and id=(p_input->>'requestId')::uuid and lead_id=l.id));
  if not found then raise exception 'Label target unavailable';end if;
 else
  checked:=chat_agent_load(p_context,p_input);
  select * into v from chat_conversations where tenant_id=t and id=(p_input->>'conversationId')::uuid;
 end if;
 select * into c from chat_channels where tenant_id=t and id=v.channel_id and is_active;
 if p_action not in ('claim','record','uncertain') or p_action is null then raise exception 'Invalid label action';end if;
 select * into r from chat_handoff_labels where tenant_id=t and conversation_id=v.id for update;
 if not found then return jsonb_build_object('status','none');end if;
 if p_action='claim' then
  if r.state<>'pending' then return jsonb_build_object('status',r.state);end if;
  update chat_handoff_labels set state='sending' where tenant_id=t and conversation_id=v.id;
  return jsonb_build_object('status','claimed','workspaceId',c.workspace_id,'accountId',(select chatwoot_account_id from chat_workspaces where tenant_id=t and id=c.workspace_id),'conversationId',v.chatwoot_conversation_id,'label','osplus-handoff');
 end if;
 if r.state='sent' then return jsonb_build_object('status','sent');end if;
 if r.state<>'sending' then raise exception 'Label reconciliation required';end if;
 update chat_handoff_labels set state=case when p_action='record' then 'sent' else 'uncertain' end,sent_at=case when p_action='record' then now() else null end where tenant_id=t and conversation_id=v.id;
 return jsonb_build_object('status',case when p_action='record' then 'sent' else 'uncertain' end);
end $$;
revoke all on function chat_handoff_label(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_handoff_label(jsonb,text,jsonb) to service_role;
commit;
