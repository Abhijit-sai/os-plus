-- Authenticated shared staff-send claims. No browser profile can independently replay a draft.
begin;
create table public.chat_draft_sends (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 run_id uuid not null,actor_tenant_user_id uuid not null,provider_note_id bigint not null check(provider_note_id>0),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'uncertain' check(state in ('uncertain','sent')),
 reported_message_id bigint check(reported_message_id>0),
 provider_message_id bigint check(provider_message_id>0),created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,run_id),
 foreign key(tenant_id,run_id) references chat_agent_runs(tenant_id,id),
 foreign key(tenant_id,actor_tenant_user_id) references tenant_users(tenant_id,id)
);
alter table public.chat_draft_sends enable row level security;
revoke all on public.chat_draft_sends from public,anon,authenticated,service_role;
grant select on public.chat_draft_sends to service_role;
create function public.chat_staff_draft_command(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;member tenant_users;run chat_agent_runs;claim chat_draft_sends;
 conv chat_conversations;ch chat_channels;w chat_workspaces;latest uuid;pack uuid;hash text;inserted integer;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or p_context->>'source' is distinct from 'OS_PLUS_UI'
  or nullif(btrim(p_context->>'correlationId'),'') is null or p_action not in ('claim','record')
  or p_action is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>30000
  or p_input-array['draftId','accountId','conversationId','noteId','staffId','content','providerMessageId']<>'{}'::jsonb
 then raise exception 'Draft send unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants where id=t and status='active';if not found then raise exception 'Draft send unavailable';end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled and config_json->>'staffDraftSendEnabled'='true';
 if not found then raise exception 'Draft send disabled';end if;
 select * into member from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and status='active' and role in ('owner_admin','manager');
 if not found then raise exception 'Draft send unavailable';end if;
 select * into run from chat_agent_runs where tenant_id=t and id=(p_input->>'draftId')::uuid;
 if not found or run.status<>'delivered' or run.delivery_note_id is distinct from (p_input->>'noteId')::bigint then raise exception 'Draft unavailable';end if;
 select * into conv from chat_conversations where tenant_id=t and id=run.conversation_id;
 select * into ch from chat_channels where tenant_id=t and id=run.channel_id and is_active;
 if not found then raise exception 'Draft unavailable';end if;
 select * into w from chat_workspaces where tenant_id=t and id=ch.workspace_id and status='active';
 if not found or w.chatwoot_account_id is distinct from (p_input->>'accountId')::bigint
  or conv.chatwoot_conversation_id is distinct from (p_input->>'conversationId')::bigint then raise exception 'Draft unavailable';end if;
 perform 1 from chat_staff_links where tenant_id=t and tenant_user_id=member.id and chatwoot_user_id=(p_input->>'staffId')::bigint;
 if not found then raise exception 'Use matching staff accounts';end if;
 hash:=encode(sha256(convert_to(coalesce(p_input->>'content',''),'UTF8')),'hex');
 select * into claim from chat_draft_sends where tenant_id=t and run_id=run.id for update;
 if found then
  if claim.actor_tenant_user_id<>member.id then return jsonb_build_object('status',claim.state);end if;
  if claim.request_hash<>hash then raise exception 'Draft retry changed';end if;
  if p_action='record' and claim.state='sent' and claim.provider_message_id is distinct from (p_input->>'providerMessageId')::bigint then raise exception 'Receipt retry changed';end if;
  if p_action='record' and claim.state='uncertain' then
   if coalesce(p_input->>'providerMessageId','')!~'^[1-9][0-9]{0,14}$' then raise exception 'Invalid receipt';end if;
   -- A browser receipt is reported evidence only. Authenticated capture establishes provider identity.
   if claim.reported_message_id is not null and claim.reported_message_id<>(p_input->>'providerMessageId')::bigint then raise exception 'Receipt retry changed';end if;
   if claim.reported_message_id is not null then return jsonb_build_object('status','uncertain');end if;
   update chat_draft_sends set reported_message_id=(p_input->>'providerMessageId')::bigint where tenant_id=t and id=claim.id;
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
    values(t,'chat.draft.receipt_reported','chat_conversation',conv.id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('draftId',run.id));
   return jsonb_build_object('status','uncertain');
  end if;
  return jsonb_build_object('status',claim.state);
 end if;
 if p_action<>'claim' then raise exception 'Draft claim unavailable';end if;
 if length(coalesce(p_input->>'content','')) not between 1 and 6000
  or p_input->>'content' ~ '[{}<>]' then raise exception 'Unsafe draft content';end if;
 perform 1 from chat_brands where tenant_id=t and id=ch.brand_id and is_active and deleted_at is null;
 if not found then raise exception 'Draft unavailable';end if;
 select id into pack from chat_knowledge_packs where tenant_id=t and brand_id=ch.brand_id and status='published';
 select id into latest from chat_messages where tenant_id=t and conversation_id=conv.id and not private and author='customer' order by created_at desc,chatwoot_message_id desc limit 1;
 if latest is distinct from run.trigger_message_id or pack is distinct from run.pack_id
  or exists(select 1 from chat_messages where tenant_id=t and conversation_id=conv.id and not private and author in ('staff','bot') and chatwoot_message_id>(select chatwoot_message_id from chat_messages where tenant_id=t and id=run.trigger_message_id))
 then raise exception 'Suggestion is no longer current';end if;
 insert into chat_draft_sends(tenant_id,run_id,actor_tenant_user_id,provider_note_id,request_hash)
 values(t,run.id,member.id,run.delivery_note_id,hash);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.draft.claimed','chat_conversation',conv.id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('draftId',run.id));
 return jsonb_build_object('status','claimed');
end $$;
revoke all on function public.chat_staff_draft_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_staff_draft_command(jsonb,text,jsonb) to service_role;
-- Validate explicit provenance BEFORE native capture computes staff clocks; never compare fuzzy text.
alter function public.chat_capture(jsonb,text,jsonb) rename to chat_capture_before_draft_sends;
revoke all on function public.chat_capture_before_draft_sends(jsonb,text,jsonb) from public,anon,authenticated,service_role;
create function public.chat_capture(p_context jsonb,p_kind text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;m jsonb:=p_input->'message';claim chat_draft_sends;verified boolean:=false;result jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
  or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
 then raise exception 'Invalid capture context';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 if m->>'author'='staff' and m->>'private'='false' and jsonb_typeof(m->'sourceDraft')='object' then
  select send.* into claim from chat_draft_sends send
  join chat_agent_runs r on r.tenant_id=t and r.id=send.run_id
  join chat_conversations cv on cv.tenant_id=t and cv.id=r.conversation_id and cv.chatwoot_conversation_id=(m->>'conversationId')::bigint
  join chat_channels ch on ch.tenant_id=t and ch.id=r.channel_id and ch.id=(p_input->>'channelId')::uuid and ch.chatwoot_inbox_id=(m->>'inboxId')::bigint
  join chat_workspaces w on w.tenant_id=t and w.id=ch.workspace_id and w.id=(p_input->>'workspaceId')::uuid and w.webhook_secret_hash=p_input->>'secretHash' and w.chatwoot_account_id=(m->>'accountId')::bigint
  join chat_staff_links staff on staff.tenant_id=t and staff.tenant_user_id=send.actor_tenant_user_id and staff.chatwoot_user_id=(m->>'staffUserId')::bigint
  where send.tenant_id=t and send.run_id=(m#>>'{sourceDraft,draftId}')::uuid and send.provider_note_id=(m#>>'{sourceDraft,noteId}')::bigint
   and send.request_hash=encode(sha256(convert_to(coalesce(m->>'content',''),'UTF8')),'hex')
   and (send.provider_message_id is null or send.provider_message_id=(m->>'messageId')::bigint) for update of send;
  if found then
   verified:=true;
   update chat_draft_sends set state='sent',provider_message_id=(m->>'messageId')::bigint where tenant_id=t and id=claim.id;
   m:=jsonb_set(jsonb_set(m,'{author}','"bot"'),'{staffUserId}','null');
  end if;
 end if;
 m:=m-'sourceDraft';
 result:=chat_capture_before_draft_sends(p_context,p_kind,jsonb_set(p_input,'{message}',m));
 return result;
end $$;
revoke all on function public.chat_capture(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_capture(jsonb,text,jsonb) to service_role;
commit;
