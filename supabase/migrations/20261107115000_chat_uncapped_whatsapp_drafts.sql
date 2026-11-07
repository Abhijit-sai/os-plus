begin;
-- Only an explicitly opted-in WhatsApp channel may use a NULL monthly cap.
create or replace function public.chat_ai_budget_settings(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; s chat_settings; old command_idempotency; h text; k text:=p_context->>'idempotencyKey'; result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner access required'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or p_input-array['monthlyBudgetUsd','version']<>'{}'::jsonb then raise exception 'Invalid AI budget'; end if;
 if p_input<>'{}'::jsonb then
  if nullif(k,'') is null or length(k)>160 or jsonb_typeof(p_input->'monthlyBudgetUsd') is distinct from 'string'
   or coalesce(p_input->>'monthlyBudgetUsd','')!~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$'
   or jsonb_typeof(p_input->'version') is distinct from 'number'
   or (p_input->>'version')::numeric not between 0 and 2147483646
   or (p_input->>'version')::numeric<>trunc((p_input->>'version')::numeric) then raise exception 'Invalid AI budget'; end if;
  h:=encode(extensions.digest(jsonb_build_array(p_input,p_context#>>'{actor,id}')::text,'sha256'),'hex');
  select * into old from command_idempotency where tenant_id=t and command_type='CHAT_AI_BUDGET' and idempotency_key=k for update;
  if found then
   if old.request_hash<>h or old.status<>'completed' then raise exception 'AI budget retry changed'; end if;
   return old.result_json;
  end if;
 end if;
 select * into s from chat_settings where tenant_id=t for update;
 if not found then raise exception 'AI budget unavailable'; end if;
 if p_input<>'{}'::jsonb then
  if s.ai_budget_version is distinct from (p_input->>'version')::integer then raise exception 'AI budget changed; reload'; end if;
  update chat_settings set monthly_budget_usd=(p_input->>'monthlyBudgetUsd')::numeric,ai_budget_version=ai_budget_version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t returning * into s;
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.ai.budget_saved','chat_settings',s.id,'USER',p_context#>>'{actor,id}',p_context->>'source',p_context->>'correlationId',p_input-'version');
 end if;
 result:=jsonb_build_object('monthlyBudgetUsd',case when s.monthly_budget_usd::text~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$' then s.monthly_budget_usd::text else null end,'version',s.ai_budget_version);
 if s.monthly_budget_usd is null and exists (
   select 1 from tenant_modules tm
   join chat_channels ch on ch.tenant_id=tm.tenant_id
     and ch.id::text=tm.config_json->>'uncappedDraftChannelId'
   where tm.tenant_id=t and tm.module_key='chat_leads' and tm.is_enabled
     and tm.config_json->>'agentEnabled'='true'
     and ch.kind='whatsapp' and ch.agent_mode='draft' and ch.is_active and not ch.can_book
 ) then
  result:=result||jsonb_build_object('uncappedDrafts',true);
 end if;
 if p_input<>'{}'::jsonb then
  insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
   values(t,'CHAT_AI_BUDGET',k,h,'completed',result,now());
 end if;
 return result;
end $$;
revoke all on function public.chat_ai_budget_settings(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_ai_budget_settings(jsonb,jsonb) to service_role;

-- Live drafts use this wrapper; the released mock/action command stays unchanged.
create or replace function public.chat_live_agent_run(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; loaded jsonb; cap numeric;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
  or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
  or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Live assistance unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 if p_action not in ('budget.settle','delivery.record','delivery.uncertain') then
  loaded:=chat_agent_load(p_context,jsonb_build_object('workspaceId',p_input->'workspaceId','secretHash',p_input->'secretHash',
   'channelId',p_input->'channelId','conversationId',p_input->'conversationId','triggerMessageId',p_input->'triggerMessageId'));
  if loaded->>'agentMode' is distinct from 'draft' or exists(select 1 from chat_channels where tenant_id=t and id=(loaded->>'channelId')::uuid and can_book)
   then raise exception 'Live assistance supports private drafts only'; end if;
  if p_action in ('claim','budget.reserve') then
   select monthly_budget_usd into cap from chat_settings where tenant_id=t for update;
   if not found
      or (cap is null and not exists (
        select 1 from tenant_modules tm
        where tm.tenant_id=t and tm.module_key='chat_leads' and tm.is_enabled
          and tm.config_json->>'uncappedDraftChannelId'=loaded->>'channelId'
          and loaded->>'channelKind'='whatsapp'
      ))
      or (cap is not null and cap::text!~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$') then
    if p_action='claim' then return jsonb_build_object('status','budget_unconfigured'); end if;
    return jsonb_build_object('admitted',false,'reason','budget_unconfigured');
   end if;
  end if;
 end if;
 -- Generic reservation repeats newest-trigger, quiet, pack, lease and locked-spend checks.
 -- Late settlement/remote receipts remain possible after revocation; original capabilities are required.
 return chat_agent_run(p_context,p_action,p_input);
end $$;
revoke all on function public.chat_live_agent_run(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_live_agent_run(jsonb,text,jsonb) to service_role;
commit;
