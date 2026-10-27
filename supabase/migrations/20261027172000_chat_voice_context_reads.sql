begin;
-- Effective text is derived, never an overwrite of the customer-authored message.
create function chat_message_is_voice(t uuid,mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from chat_messages m,jsonb_array_elements(m.attachments_json) a where m.tenant_id=t and m.id=mid and a->>'file_type'='audio')
$$;
create function chat_message_text(t uuid,mid uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case when j.state='ready' and j.note_state='sent' then concat_ws(E'\n',nullif(m.content,''),m.transcript) else m.content end
 from chat_messages m left join chat_voice_jobs j on j.tenant_id=t and j.trigger_message_id=m.id where m.tenant_id=t and m.id=mid
$$;
revoke all on function chat_message_is_voice(uuid,uuid),chat_message_text(uuid,uuid) from public,anon,authenticated,service_role;
alter function chat_agent_load(jsonb,jsonb) rename to chat_agent_load_before_voice;
revoke all on function chat_agent_load_before_voice(jsonb,jsonb) from public,anon,authenticated,service_role;
create function chat_agent_load(p_context jsonb,p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare data jsonb;t uuid:=(p_context->>'tenantId')::uuid;messages jsonb;msg chat_messages;s chat_settings;needed boolean;item jsonb;prior_at timestamptz;pending boolean:=false;incomplete boolean:=false;fresh_hours numeric;
begin
 data:=chat_agent_load_before_voice(p_context,p_input);
 select * into msg from chat_messages where tenant_id=t and id=(p_input->>'triggerMessageId')::uuid;
 needed:=chat_message_is_voice(t,msg.id);
 select * into s from chat_settings where tenant_id=t;
 select coalesce(jsonb_agg(case when chat_message_is_voice(t,(x->>'id')::uuid) then x||jsonb_build_object('content',chat_message_text(t,(x->>'id')::uuid),'originalContent',x->'content','inputSource','voice','voicePending',not exists(select 1 from chat_voice_jobs j where j.tenant_id=t and j.trigger_message_id=(x->>'id')::uuid and j.state='ready' and j.note_state='sent')) else x end order by ord),'[]'::jsonb)
 into messages from jsonb_array_elements(data->'messages') with ordinality a(x,ord);
 fresh_hours:=coalesce((data#>>'{pack,body,agent,session,freshHours}')::numeric,24);
 for item in select x from jsonb_array_elements(messages) x where x->>'private'='false' and x->>'author'<>'system' order by (x->>'at')::timestamptz,(x->>'providerId')::bigint loop
  if prior_at is not null and (item->>'at')::timestamptz-prior_at>make_interval(secs=>(fresh_hours*3600)::double precision) then pending:=false;end if;
  if item->>'author' in ('staff','bot') then pending:=false;end if;
  if item->>'id'=msg.id::text then incomplete:=pending;exit;end if;
  if item->>'author'='customer' and item->>'voicePending'='true' then pending:=true;end if;
  prior_at:=(item->>'at')::timestamptz;
 end loop;
 return data||jsonb_build_object('messages',messages,'voice',case when needed or incomplete then jsonb_build_object('required',true,'incompleteAudio',incomplete,'enabled',s.voice_enabled,'maxBytes',s.voice_max_bytes,'maxSeconds',s.voice_max_seconds) else null end);
end $$;
revoke all on function chat_agent_load(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_agent_load(jsonb,jsonb) to service_role;
commit;

-- Restate affected Chat-owned commands; preserve all existing text behavior and add derived evidence only.
begin;
create or replace function public.chat_agent_run(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; loaded jsonb; scope jsonb; r chat_agent_runs; turn chat_turns;
 pack chat_knowledge_packs; entry chat_agent_cost_entries; cap numeric; spent numeric; amount numeric; actual numeric;
 period date:=date_trunc('month',timezone('UTC',now()))::date; newest uuid;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
 or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
 or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>245000
 or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','runId','leaseToken','callKey','maxUsd','actualUsd','generationId','result','providerNoteId']<>'{}'::jsonb
 or p_action is null or p_action not in ('claim','budget.reserve','budget.settle','complete','delivery.claim','delivery.record','delivery.uncertain')
 then raise exception 'Agent command unavailable'; end if;
 -- Match capture/configuration lock order; no network or models execute inside this transaction.
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 scope:=jsonb_build_object('workspaceId',p_input->'workspaceId','secretHash',p_input->'secretHash','channelId',p_input->'channelId',
  'conversationId',p_input->'conversationId','triggerMessageId',p_input->'triggerMessageId');
 if p_action not in ('budget.settle','delivery.record','delivery.uncertain') then
  loaded:=chat_agent_load(p_context,scope);
  perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled and config_json->>'agentEnabled'='true';
  if not found then raise exception 'Agent engine disabled'; end if;
 end if;
 if p_action='claim' then
  if p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId']<>'{}'::jsonb then raise exception 'Invalid claim'; end if;
  select id into newest from chat_messages where tenant_id=t and conversation_id=(p_input->>'conversationId')::uuid and author='customer' and not private
   order by created_at desc,chatwoot_message_id desc limit 1;
  if newest is distinct from (p_input->>'triggerMessageId')::uuid then return jsonb_build_object('status','superseded'); end if;
  if (loaded->>'quietUntil')::timestamptz>now() then return jsonb_build_object('status','quiet'); end if;
  select * into turn from chat_turns where tenant_id=t and trigger_message_id=newest for update;
  if not found then raise exception 'Captured agent turn unavailable'; end if;
  select * into r from chat_agent_runs where tenant_id=t and trigger_message_id=newest for update;
  if found then
   if r.status='ready' then return jsonb_build_object('status','ready','runId',r.id,'leaseToken',r.lease_token); end if;
   if r.status<>'running' then return jsonb_build_object('status',r.status); end if;
   if r.lease_until>now() or exists(select 1 from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state<>'settled')
   then return jsonb_build_object('status','busy'); end if;
   update chat_agent_runs set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where tenant_id=t and id=r.id returning * into r;
  else
   if turn.decision_json->>'reason' is distinct from 'engine_not_enabled' then return jsonb_build_object('status','finished'); end if;
   select * into pack from chat_knowledge_packs where tenant_id=t and brand_id=(loaded->>'brandId')::uuid and status='published' order by version desc limit 1;
   insert into chat_agent_runs(tenant_id,conversation_id,trigger_message_id,turn_id,channel_id,pack_id,pack_version)
   values(t,(p_input->>'conversationId')::uuid,newest,turn.id,(p_input->>'channelId')::uuid,pack.id,pack.version) returning * into r;
  end if;
  return jsonb_build_object('status','claimed','runId',r.id,'leaseToken',r.lease_token,'context',loaded);
 end if;
 if p_action='complete' and ((loaded#>>'{voice,incompleteAudio}')::boolean or exists(select 1 from jsonb_array_elements(loaded->'messages') x where x->>'id'=p_input->>'triggerMessageId' and x->>'voicePending'='true')) then
  if p_input#>>'{result,decision,reason}' is distinct from 'unreadable_voice' or p_input#>'{result,models}' is distinct from '[]'::jsonb or not coalesce((p_input#>'{result,checks}') ? 'voice_requires_review',false)
   then raise exception 'Incomplete voice requires staff review';end if;
 end if;
 if p_action in ('complete','delivery.claim','delivery.record','delivery.uncertain') then return chat_agent_finish(p_context,p_action,p_input,loaded); end if;
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
 and conversation_id=(p_input->>'conversationId')::uuid and channel_id=(p_input->>'channelId')::uuid
 and trigger_message_id=(p_input->>'triggerMessageId')::uuid for update;
 if not found or p_input->>'callKey' not in ('understand','classify','write','rewrite','transcribe') or p_input->>'callKey' is null
 then raise exception 'Agent reservation unavailable'; end if;
 if p_action='budget.reserve' then
  if p_input->>'callKey'='transcribe' and not exists(select 1 from chat_voice_jobs j join chat_settings s on s.tenant_id=t and s.voice_enabled where j.tenant_id=t and j.run_id=r.id and j.state='processing' and j.settings_version=s.voice_version) then raise exception 'No active voice transcription claim';end if;
  -- Revalidate immediately before authorising spend; a valid lease does not make stale context safe.
  select id into newest from chat_messages where tenant_id=t and conversation_id=r.conversation_id
   and author='customer' and not private order by created_at desc,chatwoot_message_id desc limit 1;
  select * into pack from chat_knowledge_packs where tenant_id=t and brand_id=(loaded->>'brandId')::uuid and status='published';
  if newest is distinct from r.trigger_message_id or (loaded->>'quietUntil')::timestamptz>now()
   or r.pack_id is distinct from pack.id then
   return jsonb_build_object('admitted',false,'reason','superseded');
  end if;
  if r.status<>'running' or r.lease_token<>(p_input->>'leaseToken')::uuid or (p_input->>'leaseToken') is null or r.lease_until<=now()
  or coalesce(p_input->>'maxUsd','')!~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$' then raise exception 'Agent reservation unavailable'; end if;
  amount:=(p_input->>'maxUsd')::numeric;if amount<=0 then raise exception 'Unknown call maximum'; end if;
  if exists(select 1 from chat_agent_cost_entries where tenant_id=t and run_id=r.id and call_key=p_input->>'callKey')
  then return jsonb_build_object('admitted',false,'reason','existing_call'); end if;
  select monthly_budget_usd into cap from chat_settings where tenant_id=t for update;
  if not found then raise exception 'Budget unavailable'; end if;
  select coalesce(sum(case when state='settled' then actual_usd else max_usd end),0) into spent
   from chat_agent_cost_entries where tenant_id=t and month_start=period;
  -- Preserve any earlier recorded turn costs which predate reservation accounting.
  spent:=spent+(select coalesce(sum(cost_usd),0) from chat_turns prior where prior.tenant_id=t
   and timezone('UTC',prior.created_at)>=period::timestamp
   and not exists(select 1 from chat_agent_runs run join chat_agent_cost_entries e on e.tenant_id=t and e.run_id=run.id where run.tenant_id=t and run.turn_id=prior.id));
  if cap is not null and spent+amount>cap then return jsonb_build_object('admitted',false,'reason','budget'); end if;
  insert into chat_agent_cost_entries(tenant_id,run_id,call_key,lease_token,max_usd)
  values(t,r.id,p_input->>'callKey',r.lease_token,amount);
  return jsonb_build_object('admitted',true);
 end if;
 -- Late accounting is allowed after module revocation, but only for the original reserved call's capability.
 select * into entry from chat_agent_cost_entries where tenant_id=t and run_id=r.id and call_key=p_input->>'callKey' for update;
 if not found or entry.lease_token is distinct from (p_input->>'leaseToken')::uuid then raise exception 'Reservation unavailable'; end if;
 if p_input->>'actualUsd' is not null and p_input->>'actualUsd'!~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$'
 or length(coalesce(p_input->>'generationId',''))>200 then raise exception 'Usage unavailable'; end if;
 actual:=(p_input->>'actualUsd')::numeric;
 if entry.state='settled' then
  if entry.actual_usd is distinct from actual or entry.generation_id is distinct from p_input->>'generationId' then raise exception 'Usage retry changed'; end if;
  return jsonb_build_object('status','settled');
 end if;
 update chat_agent_cost_entries set actual_usd=actual,state=case when actual is null then 'uncertain' else 'settled' end,
  generation_id=p_input->>'generationId',settled_at=case when actual is null then null else now() end where tenant_id=t and id=entry.id;
 update chat_turns set cost_usd=(select coalesce(sum(actual_usd),0) from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state='settled')
  where tenant_id=t and id=r.turn_id;
 return jsonb_build_object('status',case when actual is null then 'uncertain' else 'settled' end);
end $$;

create or replace function public.chat_request_store(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid; key text:=p_context->>'idempotencyKey'; request_hash text; receipt command_idempotency%rowtype;
 l leads%rowtype; c chat_channels%rowtype; m chat_messages%rowtype; p chat_knowledge_packs%rowtype;
 r chat_action_requests%rowtype; result jsonb; fingerprint text; details jsonb:=p_input->'details'; duplicate boolean:=false;
begin
 t:=(p_context->>'tenantId')::uuid;
 if key is null or length(key) not between 1 and 160 or p_action is null or p_action not in ('request.save','request.revise','request.withdraw') or jsonb_typeof(p_input) is distinct from 'object'
  then raise exception 'Invalid chat action'; end if;
 request_hash:=encode(digest(p_action||p_input::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_ACTION' and idempotency_key=key for update;
 if found then
  if receipt.request_hash<>request_hash or receipt.status<>'completed' then raise exception 'Chat action conflict'; end if;
  return receipt.result_json;
 end if;
 if p_action<>'request.save' then
  select * into r from chat_action_requests where tenant_id=t and id=(p_input->>'id')::uuid for update;
  if not found or r.version is distinct from (p_input->>'version')::integer then raise exception 'Request changed; reload'; end if;
  if r.status='materialized' then raise exception 'Operational changes require a handoff'; end if;
  if r.status='withdrawn' then raise exception 'Request was withdrawn'; end if;
  if p_action='request.withdraw' then
   update chat_action_requests set status='withdrawn',confirmed_revision=null,confirmation_message_id=null,summary_message_id=null,review_text=null,review_pack_id=null,review_revision=null,review_prepared_at=null,
    version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
   perform chat_lead_event(p_context,r.lead_id,'request.withdrawn',jsonb_build_object('requestId',r.id,'revision',r.revision));
   result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'duplicate',false);
  else p_input:=p_input||jsonb_build_object('leadId',r.lead_id,'capability',r.capability);
  end if;
 end if;
 if p_action<>'request.withdraw' then
 if not chat_request_details_valid(details) then raise exception 'Invalid request details'; end if;
 -- A set of services has the same identity regardless of checkbox/model ordering.
 details:=jsonb_set(details,'{services}',coalesce((select jsonb_agg(v order by v) from jsonb_array_elements_text(details->'services') v),'[]'::jsonb));
 select * into l from leads where tenant_id=t and id=(p_input->>'leadId')::uuid and closed_at is null for update;
 if not found then raise exception 'Enquiry unavailable'; end if;
 perform 1 from chat_contacts where tenant_id=t and id=l.contact_id and merged_into is null and deleted_at is null for share;
 if not found then raise exception 'Contact changed'; end if;
 select * into c from chat_channels where tenant_id=t and id=l.channel_id and brand_id=l.brand_id and is_active and can_book for share;
 if not found then raise exception 'Requests unavailable for this channel'; end if;
 perform 1 from chat_workspaces where tenant_id=t and id=c.workspace_id and status='active' for share;
 if not found then raise exception 'Chat connection unavailable'; end if;
 perform 1 from chat_brands where tenant_id=t and id=l.brand_id and is_active and deleted_at is null for share;
 if not found then raise exception 'Business unavailable'; end if;
 select * into p from chat_knowledge_packs where tenant_id=t and brand_id=l.brand_id and status='published' order by version desc limit 1 for share;
 if not found or (p.pack_json#>>'{booking,capability}') is distinct from (p_input->>'capability')
  or p_input->>'capability' not in ('follow_up_task','laundry_pickup') then raise exception 'Booking capability unavailable'; end if;
 if p_input->>'capability'='laundry_pickup' then perform assert_laundry_vertical_enabled(t); end if;
 if exists(select 1 from jsonb_array_elements_text(details->'services') s where not exists(
  select 1 from jsonb_array_elements(p.pack_json->'services') configured where configured->>'key'=s)) then raise exception 'Unsupported service'; end if;
 select * into m from chat_messages where tenant_id=t and conversation_id=l.conversation_id and id=(p_input->>'sourceMessageId')::uuid and author='customer' and not private;
 if not found or nullif(btrim(p_input->>'evidence'),'') is null or length(p_input->>'evidence')>2000
  or strpos(coalesce(chat_message_text(t,m.id),''),p_input->>'evidence')=0 then raise exception 'Customer request evidence unavailable'; end if;
 fingerprint:=encode(digest(jsonb_build_array(p_input->>'capability',lower(btrim(coalesce(details->>'area',''))),
  (select jsonb_agg(v order by v) from jsonb_array_elements_text(details->'services') v))::text,'sha256'),'hex');
 -- The tenant lock also serializes this one-hour exact-contact fence across conversations.
 if p_action='request.revise' then
  update chat_action_requests set details_json=details,source_message_id=m.id,evidence=p_input->>'evidence',dedup_hash=fingerprint,
   status='requested',revision=revision+1,version=version+1,confirmed_revision=null,confirmation_message_id=null,summary_message_id=null,review_text=null,review_pack_id=null,review_revision=null,review_prepared_at=null,
   updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
  perform chat_lead_event(p_context,l.id,'request.revised',jsonb_build_object('requestId',r.id,'revision',r.revision));
 else
 select * into r from chat_action_requests where tenant_id=t and brand_id=l.brand_id and contact_id=l.contact_id
  and dedup_hash=fingerprint and details_json=details and created_at>now()-interval '1 hour' and status<>'withdrawn' order by created_at desc limit 1 for update;
 if found then duplicate:=true;
 else
  insert into chat_action_requests(tenant_id,lead_id,contact_id,brand_id,channel_id,conversation_id,source_message_id,capability,details_json,evidence,dedup_hash,created_by,updated_by)
  values(t,l.id,l.contact_id,l.brand_id,l.channel_id,l.conversation_id,m.id,p_input->>'capability',details,p_input->>'evidence',fingerprint,p_context#>>'{actor,id}',p_context#>>'{actor,id}') returning * into r;
  perform chat_lead_event(p_context,l.id,'request.saved',jsonb_build_object('requestId',r.id,'revision',r.revision));
 end if;
 end if;
 result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'duplicate',duplicate);
 end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_ACTION',key,request_hash,'completed',result,now());
 return result;
end $$;

create or replace function public.chat_action_agent_run(p_context jsonb,p_action text,p_input jsonb) returns jsonb
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
   if not found or nullif(signal->>'quote','') is null or strpos(coalesce(chat_message_text(t,msg.id),''),signal->>'quote')=0 then raise exception 'Booking lacks customer evidence'; end if;
   select coalesce(jsonb_agg(svc->>'key' order by svc->>'key'),'[]') into wanted from jsonb_array_elements(pack.pack_json->'services') svc
    where (u->'services') ? (svc->>'key') and exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=run.conversation_id and m.author='customer' and not m.private
     and m.created_at>=(run.result_json#>>'{ledger,sessionStartedAt}')::timestamptz
     and (strpos(lower(coalesce(chat_message_text(t,m.id),'')),lower(svc->>'name'))>0 or exists(select 1 from jsonb_array_elements_text(coalesce(svc->'aliases','[]')) alias where strpos(lower(coalesce(chat_message_text(t,m.id),'')),lower(alias))>0)));
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
     and m.created_at>=(run.result_json#>>'{ledger,sessionStartedAt}')::timestamptz and strpos(coalesce(chat_message_text(t,m.id),''),slot->>'quote')>0 and strpos(slot->>'quote',slot->>'value')>0;
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

create or replace function public.chat_request_workflow(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid;key text:=p_context->>'idempotencyKey';h text;receipt command_idempotency%rowtype;
 r chat_action_requests%rowtype;c chat_channels%rowtype;p chat_knowledge_packs%rowtype;l leads%rowtype;
 msg chat_messages%rowtype;summary chat_messages%rowtype;person chat_contacts%rowtype;
 result jsonb;config jsonb;review text;services text;phone text;customer uuid;address_id uuid;created jsonb;
 staff uuid;task uuid;rec chat_task_records%rowtype;field text;requested date;
begin
 t:=chat_lead_authorize(p_context);
 if key is null or length(key) not between 1 and 160 or p_action is null or p_action not in ('review','confirm','approve','change')
  or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid request workflow'; end if;
 h:=encode(digest(p_action||p_input::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_REQUEST_WORKFLOW' and idempotency_key=key for update;
 if found then
  if receipt.request_hash<>h or receipt.status<>'completed' then raise exception 'Request workflow conflict'; end if;
  return receipt.result_json;
 end if;
 select * into r from chat_action_requests where tenant_id=t and id=(p_input->>'id')::uuid for update;
 if not found or r.version is distinct from (p_input->>'version')::integer then raise exception 'Request changed; reload'; end if;
 if r.status='withdrawn' then raise exception 'Request was withdrawn'; end if;
 select * into l from leads where tenant_id=t and id=r.lead_id for update;
 if p_action='change' and r.status='materialized' then
  created:=chat_handoff_upsert(p_context,l.id,(p_input->>'messageId')::uuid,'operational_change',null);
  perform chat_lead_event(p_context,l.id,'request.change_handoff',jsonb_build_object('requestId',r.id,'taskId',created->>'taskId'));
  result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'taskId',created->>'taskId','pickupId',r.pickup_id,'reviewText',null);
 else
  if r.status='materialized' then raise exception 'Operational request already materialized'; end if;
  if l.closed_at is not null then raise exception 'Enquiry closed'; end if;
  select * into c from chat_channels where tenant_id=t and id=r.channel_id and brand_id=r.brand_id and is_active and can_book for share;
  if not found then raise exception 'Booking channel unavailable'; end if;
  perform 1 from chat_workspaces where tenant_id=t and id=c.workspace_id and status='active' for share;
  if not found then raise exception 'Chat connection unavailable'; end if;
  perform 1 from chat_brands where tenant_id=t and id=r.brand_id and is_active and deleted_at is null for share;
  if not found then raise exception 'Business unavailable'; end if;
  select * into p from chat_knowledge_packs where tenant_id=t and brand_id=r.brand_id and status='published' order by version desc limit 1 for share;
  if not found or p.pack_json#>>'{booking,capability}' is distinct from r.capability then raise exception 'Current booking configuration unavailable'; end if;
  select * into person from chat_contacts where tenant_id=t and id=r.contact_id and merged_into is null and deleted_at is null for update;
  if not found or l.contact_id<>r.contact_id or l.conversation_id<>r.conversation_id then raise exception 'Contact changed'; end if;
  if r.capability='laundry_pickup' then perform assert_laundry_vertical_enabled(t); end if;
  if jsonb_array_length(r.details_json->'services')=0 or exists(select 1 from jsonb_array_elements_text(r.details_json->'services') s
   where not exists(select 1 from jsonb_array_elements(p.pack_json->'services') svc where svc->>'key'=s)) then raise exception 'Choose configured services'; end if;
  select string_agg(svc->>'name',', ' order by svc->>'key') into services from jsonb_array_elements(p.pack_json->'services') svc
   where svc->>'key' in (select jsonb_array_elements_text(r.details_json->'services'));
  if p_action='review' then
   config:=p.pack_json#>'{booking,confirmation}';
   if config is null or nullif(btrim(config->>'intro'),'') is null or jsonb_typeof(config->'phrases') is distinct from 'array' or jsonb_array_length(config->'phrases')=0
    then raise exception 'Configure reviewed confirmation wording first'; end if;
   select string_agg(svc->>'name',', ' order by svc->>'key') into services from jsonb_array_elements(p.pack_json->'services') svc
    where svc->>'key' in (select jsonb_array_elements_text(r.details_json->'services'));
   review:=config->>'intro';
   if nullif(btrim(config#>>'{labels,services}'),'') is null then raise exception 'Configure summary labels'; end if;
   review:=review||chr(10)||(config#>>'{labels,services}')||': '||services;
   foreach field in array array['name','address','date','window','timePreference'] loop
    if nullif(r.details_json->>field,'') is not null then
     if nullif(btrim(config#>>array['labels',field]),'') is null then raise exception 'Configure summary labels'; end if;
     review:=review||chr(10)||(config#>>array['labels',field])||': '||case when field='window' then
      coalesce((select v->>'label' from jsonb_array_elements(coalesce(p.pack_json#>'{booking,windows}','[]')) v where v->>'key'=r.details_json->>'window'),r.details_json->>'window') else r.details_json->>field end;
    end if;
   end loop;
   if length(review)>6000 or review~'\{\{|\}\}|\$\{' then raise exception 'Invalid summary text'; end if;
   update chat_action_requests set review_text=review,review_pack_id=p.id,review_revision=revision,review_prepared_at=clock_timestamp(),
    status='requested',confirmed_revision=null,confirmation_message_id=null,summary_message_id=null,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
  elsif p_action='confirm' then
   if r.review_text is null or r.review_pack_id is distinct from p.id or r.review_revision is distinct from r.revision then raise exception 'Current summary required'; end if;
   select * into msg from chat_messages where tenant_id=t and conversation_id=r.conversation_id and id=(p_input->>'messageId')::uuid and author='customer' and not private;
   if not found or chat_message_is_voice(t,msg.id) then raise exception 'Typed customer confirmation required'; end if;
   select * into summary from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author in ('staff','bot') and not private
    and content=r.review_text and created_at>=r.review_prepared_at and (created_at,chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id) order by created_at desc,chatwoot_message_id desc limit 1;
   if not found then raise exception 'Current public summary required before confirmation'; end if;
   if not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(msg.content)))
    or exists(select 1 from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private and (created_at,chatwoot_message_id)>(msg.created_at,msg.chatwoot_message_id))
    or exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private
     and (m.created_at,m.chatwoot_message_id)>(summary.created_at,summary.chatwoot_message_id)
     and (m.created_at,m.chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id)
     and (chat_message_is_voice(t,m.id) or not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(m.content)))))
    then raise exception 'Current exact customer confirmation required'; end if;
   update chat_action_requests set status='customer_confirmed',confirmed_revision=revision,confirmation_message_id=msg.id,summary_message_id=summary.id,
    version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
  elsif p_action='approve' then
   if r.status<>'customer_confirmed' or r.confirmed_revision is distinct from r.revision or r.review_pack_id is distinct from p.id or r.review_revision is distinct from r.revision
    then raise exception 'Current complete request confirmation required'; end if;
   select * into msg from chat_messages where tenant_id=t and conversation_id=r.conversation_id and id=r.confirmation_message_id and author='customer' and not private;
   if chat_message_is_voice(t,msg.id) then raise exception 'Typed customer confirmation required';end if;
   if not found or exists(select 1 from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private and (created_at,chatwoot_message_id)>(msg.created_at,msg.chatwoot_message_id))
    then raise exception 'Customer confirmation changed'; end if;
   -- Recheck the entire interval: delayed captures must not resurrect an obsolete summary.
   select * into summary from chat_messages where tenant_id=t and id=r.summary_message_id and conversation_id=r.conversation_id
    and author in ('staff','bot') and not private and content=r.review_text and created_at>=r.review_prepared_at
    and (created_at,chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id);
   if not found or exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private
    and (m.created_at,m.chatwoot_message_id)>(summary.created_at,summary.chatwoot_message_id)
    and (m.created_at,m.chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id)
    and (chat_message_is_voice(t,m.id) or not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(m.content)))))
    then raise exception 'Customer confirmation changed'; end if;
   select case when count(*)=1 then min(value) else null end into phone from chat_contact_identities where tenant_id=t and contact_id=person.id and kind='phone' and verified;
   if c.kind<>'whatsapp' or phone is null then raise exception 'Verified WhatsApp identity required'; end if;
   select id into staff from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and status='active' and role in ('owner_admin','manager') for share;
   if r.capability='follow_up_task' then
    update chat_task_records record set closed_at=now() from tasks taskrow where record.tenant_id=t and record.lead_id=l.id and record.task_id=taskrow.id and taskrow.tenant_id=t
     and record.closed_at is null and taskrow.status in ('COMPLETED','CANCELLED');
    select * into rec from chat_task_records where tenant_id=t and lead_id=l.id and work_kind='LEAD_FOLLOW_UP' and closed_at is null for update;
    if found then task:=rec.task_id;
    else
     created:=create_task_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId','chat-request:'||r.id::text,'LEAD_FOLLOW_UP',
      'Follow up customer request','Review the confirmed request in the linked enquiry. This task does not reserve an appointment.','lead',l.id);
     task:=(created->>'task_id')::uuid;
     insert into chat_task_records(tenant_id,lead_id,task_id,work_kind,route_source) values(t,l.id,task,'LEAD_FOLLOW_UP','unassigned');
    end if;
    update leads set booking_subject_type='task',booking_subject_id=task,booking_task_id=task,version=version+1,updated_by=p_context#>>'{actor,id}'
     where tenant_id=t and id=l.id and booking_subject_type is null;
    update chat_action_requests set status='materialized',task_id=task,approved_by=staff,approved_at=now(),version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
   else
    if length(btrim(coalesce(r.details_json->>'name',''))) not between 2 and 200 or nullif(btrim(r.details_json->>'address'),'') is null
     or r.details_json->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or nullif(r.details_json->>'date','') is null
     or not exists(select 1 from jsonb_array_elements(coalesce(p.pack_json#>'{booking,windows}','[]')) w where w->>'key'=r.details_json->>'window')
     then raise exception 'Complete Laundry details required'; end if;
    requested:=(r.details_json->>'date')::date;
    if requested<(select (now() at time zone timezone)::date from chat_settings where tenant_id=t) then raise exception 'Choose a current pickup date'; end if;
    if person.customer_id is not null then
     select id into customer from customers where tenant_id=t and id=person.customer_id and deleted_at is null and normalized_phone_e164=phone for share;
     if not found then raise exception 'Resolve exact customer identity before approval'; end if;
    else
     created:=chat_lead_command(p_context||jsonb_build_object('idempotencyKey','chat-customer:'||r.id::text),'contact.convert',
      jsonb_build_object('contactId',person.id,'name',r.details_json->>'name','phone',phone,'phoneE164',phone));
     customer:=(created->>'customerId')::uuid;
    end if;
    -- No saved address is overwritten. Structured address parts remain unknown unless staff supplied them.
    if p_input->>'countryCode' is null or p_input->>'countryCode' !~ '^[A-Z]{2}$' then raise exception 'Staff must confirm the address country'; end if;
    select id into address_id from customer_addresses where tenant_id=t and customer_id=customer and deleted_at is null
     and lower(btrim(address_line_1))=lower(btrim(r.details_json->>'address')) and country_code=p_input->>'countryCode'
     and nullif(btrim(coalesce(address_line_2,'')),'') is null and nullif(btrim(coalesce(area,'')),'') is null
     and nullif(btrim(coalesce(city,'')),'') is null and nullif(btrim(coalesce(state,'')),'') is null
     and nullif(btrim(coalesce(postal_code,'')),'') is null and nullif(btrim(coalesce(landmark,'')),'') is null
     order by created_at,id limit 1 for share;
    if address_id is null then
     insert into customer_addresses(tenant_id,customer_id,label,address_line_1,country_code,source,created_by,updated_by)
      values(t,customer,'Chat pickup',btrim(r.details_json->>'address'),p_input->>'countryCode','whatsapp',p_context#>>'{actor,id}',p_context#>>'{actor,id}') returning id into address_id;
     insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
      values(t,'chat.customer_address.created','customer_address',address_id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('requestId',r.id,'customerId',customer));
    end if;
    created:=create_laundry_pickup_request_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',
     'chat-pickup:'||r.id::text,customer,address_id,requested,r.details_json->>'window','whatsapp',null,null,null,services);
    update leads set customer_id=customer,booking_subject_type='laundry_pickup_request',booking_subject_id=(created->>'pickup_request_id')::uuid,
     booking_pickup_id=(created->>'pickup_request_id')::uuid,booking_task_id=null,version=version+1,updated_by=p_context#>>'{actor,id}'
     where tenant_id=t and id=l.id and booking_subject_type is null;
    if not found then raise exception 'Resolve the existing linked booking before approval'; end if;
    update chat_action_requests set status='materialized',pickup_id=(created->>'pickup_request_id')::uuid,task_id=(created->>'task_id')::uuid,
     customer_id=customer,approved_by=staff,approved_at=now(),version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
   end if;
  else raise exception 'Operational change requires a materialized request';
  end if;
  perform chat_lead_event(p_context,l.id,'request.'||p_action,jsonb_build_object('requestId',r.id,'revision',r.revision,'taskId',r.task_id,'pickupId',r.pickup_id));
  result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'taskId',r.task_id,'pickupId',r.pickup_id,'reviewText',r.review_text);
 end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_REQUEST_WORKFLOW',key,h,'completed',result,now());
 return result;
end $$;

create or replace function public.chat_crm_read(p_context jsonb,p_view text,p_input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; r text; pii boolean; manage boolean;
 page_number integer:=coalesce((p_input->>'page')::integer,1);
 result jsonb; target uuid; selected leads; person chat_contacts;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or p_context->>'source' is distinct from 'OS_PLUS_UI'
 or nullif(btrim(p_context->>'correlationId'),'') is null
 or jsonb_typeof(p_input) is distinct from 'object'
 or p_input-array['page','id','brandId','locationId','channelId','stage','ownerId','state','q','contactId','segment','accountId','inboxId','conversationId'] <> '{}'::jsonb
 or page_number<1 or page_number>20000 or length(coalesce(p_input->>'q',''))>100
 then raise exception 'CRM access unavailable'; end if;
 perform 1 from tenants where id=t and status='active';
 if not found then raise exception 'CRM access unavailable'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled;
 if not found then raise exception 'CRM access unavailable'; end if;
 select role into r from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and status='active';
 if r is null or (r not in ('owner_admin','manager') and not exists(select 1 from chat_role_permissions where tenant_id=t and role=r and permission='leads:view' and allowed))
 then raise exception 'CRM access unavailable'; end if;
 manage:=r in ('owner_admin','manager');
 pii:=manage or exists(select 1 from chat_role_permissions where tenant_id=t and role=r and permission='leads:pii' and allowed);
 if p_view='performance' and r<>'owner_admin' then raise exception 'CRM access unavailable'; end if;
 if p_view not in ('leads','lead','contacts','contact','performance','panel') then raise exception 'Unknown CRM view'; end if;
 if p_view='panel' then
  if not manage or p_input-array['accountId','inboxId','conversationId']<>'{}'::jsonb
   or coalesce((p_input->>'accountId')::bigint,0)<1 or coalesce((p_input->>'inboxId')::bigint,0)<1 or coalesce((p_input->>'conversationId')::bigint,0)<1
   then raise exception 'CRM access unavailable'; end if;
  select l.id into target from leads l
  join chat_conversations c on c.tenant_id=l.tenant_id and c.id=l.conversation_id
  join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
  join chat_workspaces w on w.tenant_id=ch.tenant_id and w.id=ch.workspace_id
  where l.tenant_id=t and w.status='active' and ch.is_active
   and w.chatwoot_account_id=(p_input->>'accountId')::bigint
   and ch.chatwoot_inbox_id=(p_input->>'inboxId')::bigint
   and c.chatwoot_conversation_id=(p_input->>'conversationId')::bigint
  order by (l.closed_at is null) desc,l.first_customer_at desc,l.id desc limit 1;
  return jsonb_build_object('leadId',target);
 end if;
 if p_view in ('contacts','contact') then
  if p_input?'segment' and p_input->>'segment' not in ('linked','unlinked','merged') then raise exception 'Invalid contact filter'; end if;
  if p_view='contact' then
   target:=(p_input->>'id')::uuid;
   select * into person from chat_contacts where tenant_id=t and id=target and deleted_at is null;
   if not found then return jsonb_build_object('item',null); end if;
  end if;
  with matched as (
   select c.* from chat_contacts c where c.tenant_id=t and c.deleted_at is null
    and (p_view<>'contact' or c.id=target)
    and (p_view='contact' or (coalesce(p_input->>'segment','')='merged' and c.merged_into is not null) or (coalesce(p_input->>'segment','')<>'merged' and c.merged_into is null))
    and (coalesce(p_input->>'segment','')<>'linked' or c.customer_id is not null)
    and (coalesce(p_input->>'segment','')<>'unlinked' or c.customer_id is null)
    and (coalesce(p_input->>'q','')='' or (pii and (position(lower(p_input->>'q') in lower(coalesce(c.display_name,'')))>0
     or exists(select 1 from chat_contact_identities i where i.tenant_id=t and i.contact_id=c.id and i.kind='phone' and position(p_input->>'q' in i.value)>0))))
  ), paged as (select * from matched order by last_seen_at desc,id desc limit 50 offset (page_number-1)*50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'display_name',case when pii then c.display_name else null end,'customer_id',case when pii then c.customer_id else null end,'linked',c.customer_id is not null,
   'merged_into',case when pii then c.merged_into else null end,'merged',c.merged_into is not null,'first_seen_at',c.first_seen_at,'last_seen_at',c.last_seen_at,'version',c.version,'notes',case when pii then c.notes else null end,
   'identities',case when pii then coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'value',i.value,'verified',i.verified) order by i.kind,i.id) from chat_contact_identities i where i.tenant_id=t and i.contact_id=c.id),'[]'::jsonb) else '[]'::jsonb end
  ) order by c.last_seen_at desc,c.id desc) from paged c),'[]'::jsonb),
   'total',(select count(*) from matched),'linked',(select count(*) from matched where customer_id is not null),
   'page',page_number,'permissions',jsonb_build_object('pii',pii,'manage',manage,'reports',r='owner_admin'),'asOf',now()) into result;
  if p_view='contacts' then return result; end if;
  return result || jsonb_build_object('item',result#>'{items,0}','details',jsonb_build_object(
   'identities',case when pii then coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'value',i.value,'verified',i.verified) order by i.kind,i.id) from chat_contact_identities i where i.tenant_id=t and i.contact_id=target),'[]'::jsonb) else '[]'::jsonb end,
   'customer',case when manage then (select jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'email',c.email) from customers c where c.tenant_id=t and c.id=person.customer_id and c.deleted_at is null) else null end,
   'matchingCustomers',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name))
     from customers c join chat_contact_identities i on i.tenant_id=c.tenant_id and i.kind='phone' and i.verified and i.value=c.normalized_phone_e164
     where c.tenant_id=t and c.deleted_at is null and i.contact_id=target),'[]'::jsonb) else '[]'::jsonb end,
   'orders',case when manage then coalesce((select jsonb_agg(x order by x.order_date desc,x.id desc) from (
     select o.id,o.order_number,o.order_date,o.order_status::text status,o.total_amount total,o.amount_paid paid,o.source_currency_code currency
     from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled') order by o.order_date desc,o.id desc limit 20) x),'[]'::jsonb) else '[]'::jsonb end,
   'orderCount',case when manage then (select count(*) from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled')) else 0 end,
   'lifetime',case when manage then coalesce((select jsonb_agg(x) from (select o.source_currency_code currency,sum(o.total_amount) amount from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled') group by o.source_currency_code order by o.source_currency_code) x),'[]'::jsonb) else '[]'::jsonb end,
   'merges',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'at',m.created_at,'splitAt',m.split_at) order by m.created_at desc,m.id desc) from (select * from chat_contact_merges where tenant_id=t and (from_contact_id=target or to_contact_id=target) order by created_at desc,id desc limit 20) m),'[]'::jsonb) else '[]'::jsonb end,
   'language',case when pii and length(person.prefs_json->>'language') between 2 and 35 then person.prefs_json->>'language' else null end
  ));
 end if;
 if p_input?'stage' and p_input->>'stage' not in ('new','engaged','booked','in_progress','won','lost')
 or p_input?'state' and p_input->>'state' not in ('waiting','hot','unassigned','handoff','needs_look')
 then raise exception 'Invalid CRM filter'; end if;
 if p_view='lead' then
  target:=(p_input->>'id')::uuid;
  select * into selected from leads where tenant_id=t and id=target;
  if not found then return jsonb_build_object('item',null); end if;
 end if;
 with filtered as (
  select l.*,
   case when pii then c.display_name else null end display_name,
   b.name brand_name, ch.name channel_name,
   (l.closed_at is null and (l.last_reply_at is null or l.last_reply_at<l.last_customer_at)) waiting,
   (l.closed_at is null and l.kind='sales' and l.intent is not null and l.last_customer_at<=now()
    and l.last_customer_at>now()-make_interval(hours=>s.hot_hours)
    and coalesce(k.pack_json#>'{crm,hotIntents}','[]'::jsonb)?l.intent) hot
  from leads l
  join chat_contacts c on c.tenant_id=l.tenant_id and c.id=l.contact_id
  join chat_brands b on b.tenant_id=l.tenant_id and b.id=l.brand_id
  join chat_channels ch on ch.tenant_id=l.tenant_id and ch.id=l.channel_id
  join chat_settings s on s.tenant_id=l.tenant_id
  left join chat_knowledge_packs k on k.tenant_id=l.tenant_id and k.brand_id=l.brand_id and k.status='published'
  where l.tenant_id=t and (p_view<>'lead' or l.id=target)
   and (not(p_input?'brandId') or l.brand_id=(p_input->>'brandId')::uuid)
   and (not(p_input?'locationId') or l.location_id=(p_input->>'locationId')::uuid)
   and (not(p_input?'channelId') or l.channel_id=(p_input->>'channelId')::uuid)
   and (not(p_input?'contactId') or l.contact_id=(p_input->>'contactId')::uuid)
   and (not(p_input?'stage') or l.stage=p_input->>'stage')
   and (not(p_input?'ownerId') or l.owner_tenant_user_id=(p_input->>'ownerId')::uuid)
   and (not(p_input?'q') or l.ref_code ilike '%'||(p_input->>'q')||'%' or (pii and c.display_name ilike '%'||(p_input->>'q')||'%'))
 ), scoped as (
  select * from filtered f where not(p_input?'state')
   or (p_input->>'state'='needs_look' and f.closed_at is null and (f.waiting or f.handoff or f.owner_tenant_user_id is null))
   or (p_input->>'state'='waiting' and f.waiting)
   or (p_input->>'state'='hot' and f.hot)
   or (p_input->>'state'='unassigned' and f.closed_at is null and f.owner_tenant_user_id is null)
   or (p_input->>'state'='handoff' and f.handoff and f.closed_at is null)
 ), reply_facts as (
  select m.*,s.tenant_user_id,chat_report_after_hours(m.created_at,k.pack_json) after_hours from chat_messages m
  join chat_conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
  join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
  left join chat_knowledge_packs k on k.tenant_id=ch.tenant_id and k.brand_id=ch.brand_id and k.status='published'
  left join chat_staff_links s on s.tenant_id=m.tenant_id and s.chatwoot_user_id=m.staff_chatwoot_user_id
  where m.tenant_id=t and m.author='staff' and not m.private
   and m.conversation_id in (select conversation_id from scoped)
 ), people as (
  select u.id,coalesce(u.display_name,'Team member') name,u.status::text status,
   (select count(*) from reply_facts f where f.tenant_user_id=u.id) replies,
   (select count(*) from scoped l where l.owner_tenant_user_id=u.id and l.closed_at is null) owned,
   (select count(*) from scoped l where l.owner_tenant_user_id=u.id and l.stage='won') won,
   case when not exists(select 1 from reply_facts f where f.tenant_user_id=u.id) or exists(select 1 from reply_facts f where f.tenant_user_id=u.id and f.after_hours is null) then null else (select count(*) from reply_facts f where f.tenant_user_id=u.id and f.after_hours) end "afterHours"
  from tenant_users u where u.tenant_id=t and (u.role in ('owner_admin','manager') or exists(select 1 from chat_staff_links s where s.tenant_id=t and s.tenant_user_id=u.id))
 ), people_page as (
  select * from people order by name,id limit 50 offset (page_number-1)*50
 ), paged as (
  select * from scoped order by last_customer_at desc,id desc limit 50 offset (page_number-1)*50
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg((to_jsonb(p)-array['tenant_id','created_by','updated_by']) ||
    case when pii then '{}'::jsonb else jsonb_build_object('notes',null,'gist',null,'area',null,'services','[]'::jsonb,'customer_id',null,'display_name',null) end
    order by p.last_customer_at desc,p.id desc) from paged p),'[]'::jsonb),
  'total',(select count(*) from scoped),
  'counters',(select jsonb_build_object('open',count(*) filter(where closed_at is null),'awaitingFirstReply',count(*) filter(where closed_at is null and first_response_at is null),'waiting',count(*) filter(where waiting),'hot',count(*) filter(where hot),'unassigned',count(*) filter(where closed_at is null and owner_tenant_user_id is null),'handoff',count(*) filter(where closed_at is null and handoff)) from scoped),
  'pipeline',coalesce((select jsonb_agg(x) from (select currency,sum(est_value) amount,count(*) known from scoped where closed_at is null and kind='sales' and est_value is not null group by currency order by currency) x),'[]'::jsonb),
  'performance',case when p_view='performance' then jsonb_build_object(
   'medianFirstHumanSeconds',(select percentile_cont(0.5) within group(order by greatest(0,extract(epoch from first_human_response_at-first_customer_at))) from scoped where first_human_response_at is not null),
   'publicStaffReplies',(select count(*) from reply_facts),
   'unmappedStaffReplies',(select count(*) from reply_facts where tenant_user_id is null),
   'afterHoursUnknownReplies',(select count(*) from reply_facts where after_hours is null),
   'people',coalesce((select jsonb_agg(p order by p.name,p.id) from people_page p),'[]'::jsonb),
   'peopleCount',(select count(*) from people),
   'needsLook',coalesce((select jsonb_agg(to_jsonb(n)-array['tenant_id','created_by','updated_by'] order by n.last_customer_at,n.id) from (select * from scoped where closed_at is null and (waiting or handoff or owner_tenant_user_id is null) order by last_customer_at,id limit 20) n),'[]'::jsonb),
   'needsLookCount',(select count(*) from scoped where closed_at is null and (waiting or handoff or owner_tenant_user_id is null))
  ) else null end,
  'permissions',jsonb_build_object('pii',pii,'manage',manage,'reports',r='owner_admin'),
  'page',page_number,'asOf',now()
 ) into result;
 if p_view='lead' then
  return result || jsonb_build_object('item',result#>'{items,0}','details',jsonb_build_object(
   'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'author',m.author,'private',false,'content',case when pii then m.content else null end,'transcript',case when pii then (select m.transcript from chat_voice_jobs j where j.tenant_id=t and j.trigger_message_id=m.id and j.state='ready' and j.note_state='sent') else null end,'created_at',m.created_at) order by m.created_at,m.id)
    from (select * from chat_messages where tenant_id=t and conversation_id=selected.conversation_id and not private and author in ('customer','staff','bot') order by created_at desc,id desc limit 50) m),'[]'::jsonb),
   'messageCount',(select count(*) from chat_messages where tenant_id=t and conversation_id=selected.conversation_id and not private and author in ('customer','staff','bot')),
   'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'at',e.at,'actor_type',e.actor_type) order by e.at desc,e.id desc)
    from (select * from lead_events where tenant_id=t and lead_id=target order by at desc,id desc limit 50) e),'[]'::jsonb),
   'historyCount',(select count(*) from lead_events where tenant_id=t and lead_id=target),
   'chat',case when manage then (select jsonb_build_object('baseUrl',w.chatwoot_base_url,'accountId',w.chatwoot_account_id,'conversationId',c.chatwoot_conversation_id)
    from chat_conversations c join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
    join chat_workspaces w on w.tenant_id=ch.tenant_id and w.id=ch.workspace_id
    where c.tenant_id=t and c.id=selected.conversation_id and w.status='active') else null end,
   'owners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(u.display_name,'Team member')) order by u.display_name,u.id)
    from tenant_users u where u.tenant_id=t and u.status='active' and u.role in ('owner_admin','manager')),'[]'::jsonb),
   'draft',case when pii then (select jsonb_build_object('text',reply_text,'knowledgeVersion',knowledge_pack_version)
    from chat_turns where tenant_id=t and conversation_id=selected.conversation_id and outcome='drafted' and reply_text is not null order by created_at desc,id desc limit 1) else null end
  ));
 end if;
 return result;
end $$;
commit;

-- Reuse the same effective request evidence for already-approved on-request image gates.
begin;
create or replace function chat_supplemental_valid(p_tenant uuid,p_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare d chat_supplemental_deliveries%rowtype;l leads%rowtype;p chat_knowledge_packs%rowtype;r chat_agent_runs%rowtype;
begin
 select * into d from chat_supplemental_deliveries where tenant_id=p_tenant and id=p_id;
 if not found then return false;end if;
 select * into l from leads where tenant_id=p_tenant and id=d.lead_id and contact_id=d.contact_id and conversation_id=d.conversation_id and first_customer_at<=(select m.created_at from chat_agent_runs run join chat_messages m on m.tenant_id=p_tenant and m.id=run.trigger_message_id where run.tenant_id=p_tenant and run.id=d.run_id)
  and (closed_at is null or closed_at>=(select m.created_at from chat_agent_runs run join chat_messages m on m.tenant_id=p_tenant and m.id=run.trigger_message_id where run.tenant_id=p_tenant and run.id=d.run_id));
 select * into r from chat_agent_runs where tenant_id=p_tenant and id=d.run_id;
 select * into p from chat_knowledge_packs where tenant_id=p_tenant and id=d.pack_id and status='published';
 if l.id is null or p.id is null or r.id is null or not (
  exists(select 1 from chat_public_outbox where tenant_id=p_tenant and run_id=r.id and state='sent')
  or exists(select 1 from chat_draft_sends where tenant_id=p_tenant and run_id=r.id and state='sent' and provider_message_id is not null)) then return false;end if;
 if d.kind='price_image' then
  return p.pack_json->>'priceListImageUrl'=d.asset_url and p.pack_json#>>'{media,priceListCaption}'=d.text
   and exists(select 1 from jsonb_array_elements(coalesce(r.result_json#>'{understanding,signals}','[]')) s
    join chat_messages m on m.tenant_id=p_tenant and m.id=(s->>'messageId')::uuid and m.conversation_id=d.conversation_id and m.author='customer' and not m.private
    where s->>'kind'='price_list' and nullif(s->>'quote','') is not null and strpos(coalesce(chat_message_text(p_tenant,m.id),''),s->>'quote')>0);
 end if;
 -- Deliberately no import/paid/production-complete trigger. Shopify requires a future actual-delivery adapter.
 return coalesce((p.pack_json#>>'{review,enabled}')::boolean,false)
  and d.text=(p.pack_json#>>'{review,text}')||chr(10)||(p.pack_json#>>'{review,url}')
  and exists(select 1 from orders where tenant_id=p_tenant and id=l.order_id and id=d.order_id and customer_id=l.customer_id and deleted_at is null
   and order_status='delivered' and source<>'shopify' and updated_at>=l.first_customer_at)
  and not exists(select 1 from chat_supplemental_deliveries other where other.tenant_id=p_tenant and other.contact_id=d.contact_id and other.kind='review' and other.id<>d.id
   and (other.state in ('sending','uncertain') or (other.state='sent' and other.sent_at>now()-make_interval(days=>coalesce((p.pack_json#>>'{review,cooldownDays}')::int,90)))));
end $$;
create or replace function chat_supplemental_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;d chat_supplemental_deliveries%rowtype;r chat_agent_runs%rowtype;l leads%rowtype;p chat_knowledge_packs%rowtype;c chat_channels%rowtype;v chat_conversations%rowtype;checked jsonb;delivery_kind text;staff boolean;
begin
 staff:=p_context#>>'{actor,type}'='USER';
 if staff then perform chat_lead_authorize(p_context);
 else checked:=chat_agent_load(p_context,p_input-array['id','kind','providerMessageId','runId','leaseToken']);end if;
 if p_action is null or p_action not in ('prepare','claim','target','record','uncertain') then raise exception 'Invalid supplemental action';end if;
 if p_action='prepare' then
  select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid;
  if not staff and (r.conversation_id is distinct from (p_input->>'conversationId')::uuid or r.lease_token is distinct from (p_input->>'leaseToken')::uuid) then raise exception 'Supplemental capability unavailable';end if;
  select * into l from leads where tenant_id=t and conversation_id=r.conversation_id and first_customer_at<=(select created_at from chat_messages where tenant_id=t and id=r.trigger_message_id)
   and (closed_at is null or closed_at>=(select created_at from chat_messages where tenant_id=t and id=r.trigger_message_id)) order by created_at desc,id desc limit 1;
  select * into p from chat_knowledge_packs where tenant_id=t and id=r.pack_id and status='published';
  delivery_kind:=p_input->>'kind';
  if l.id is null or p.id is null or delivery_kind not in ('price_image','review') then raise exception 'Supplemental unavailable';end if;
  if exists(select 1 from chat_messages m join chat_messages trigger on trigger.tenant_id=t and trigger.id=r.trigger_message_id
   where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private and (m.created_at,m.chatwoot_message_id)>(trigger.created_at,trigger.chatwoot_message_id))
   then return jsonb_build_object('status','unavailable');end if;
  if delivery_kind='price_image' and exists(select 1 from jsonb_array_elements(coalesce(r.result_json#>'{understanding,signals}','[]')) s
   join chat_messages m on m.tenant_id=t and m.id=(s->>'messageId')::uuid and m.conversation_id=l.conversation_id and m.author='customer' and not m.private
   where s->>'kind'='price_list' and nullif(s->>'quote','') is not null and strpos(coalesce(chat_message_text(t,m.id),''),s->>'quote')>0) and nullif(p.pack_json->>'priceListImageUrl','') is not null and nullif(p.pack_json#>>'{media,priceListCaption}','') is not null then
   insert into chat_supplemental_deliveries(tenant_id,lead_id,conversation_id,contact_id,run_id,pack_id,kind,text,asset_url)
   values(t,l.id,l.conversation_id,l.contact_id,r.id,p.id,delivery_kind,p.pack_json#>>'{media,priceListCaption}',p.pack_json->>'priceListImageUrl')
   on conflict (tenant_id,conversation_id) where kind='price_image' do update set lead_id=excluded.lead_id,contact_id=excluded.contact_id,run_id=excluded.run_id,pack_id=excluded.pack_id,text=excluded.text,asset_url=excluded.asset_url
   where chat_supplemental_deliveries.state='draft';
  elsif delivery_kind='review' and exists(select 1 from orders where tenant_id=t and id=l.order_id and customer_id=l.customer_id and deleted_at is null and order_status='delivered' and source<>'shopify' and updated_at>=l.first_customer_at) and coalesce((p.pack_json#>>'{review,enabled}')::boolean,false) and nullif(p.pack_json#>>'{review,text}','') is not null then
   insert into chat_supplemental_deliveries(tenant_id,lead_id,conversation_id,contact_id,run_id,pack_id,kind,text,order_id)
   values(t,l.id,l.conversation_id,l.contact_id,r.id,p.id,delivery_kind,(p.pack_json#>>'{review,text}')||chr(10)||(p.pack_json#>>'{review,url}'),l.order_id)
   on conflict (tenant_id,conversation_id,order_id) where kind='review' do update set lead_id=excluded.lead_id,contact_id=excluded.contact_id,run_id=excluded.run_id,pack_id=excluded.pack_id,text=excluded.text
   where chat_supplemental_deliveries.state='draft';
  end if;
  select * into d from chat_supplemental_deliveries where tenant_id=t and conversation_id=l.conversation_id and kind=p_input->>'kind' and (kind='price_image' or order_id=l.order_id) for update;
  if d.id is null then return jsonb_build_object('status','unavailable');end if;
 else select * into d from chat_supplemental_deliveries where tenant_id=t and id=(p_input->>'id')::uuid for update;
 end if;
 if d.id is null then raise exception 'Supplemental unavailable';end if;
 if not staff and (d.conversation_id is distinct from (p_input->>'conversationId')::uuid or d.run_id is distinct from (p_input->>'runId')::uuid) then raise exception 'Supplemental scope mismatch';end if;
 if p_action='prepare' then
  if chat_supplemental_valid(t,d.id) is not true then return jsonb_build_object('status','unavailable');end if;
  return jsonb_build_object('status',d.state,'id',d.id);
 end if;
 if p_action in ('record','uncertain') then
  if d.state='sent' and p_action='record' and d.provider_message_id=(p_input->>'providerMessageId')::bigint then return jsonb_build_object('status','sent');end if;
  if d.state<>'sending' then raise exception 'Supplemental receipt unavailable';end if;
  update chat_supplemental_deliveries set state=case when p_action='record' then 'sent' else 'uncertain' end,
   provider_message_id=(p_input->>'providerMessageId')::bigint,sent_at=case when p_action='record' then now() else null end where tenant_id=t and id=d.id;
  perform chat_lead_event(p_context,d.lead_id,'supplemental.'||p_action,jsonb_build_object('id',d.id,'kind',d.kind));
  return jsonb_build_object('status',case when p_action='record' then 'sent' else 'uncertain' end);
 end if;
 -- Reserve review cooldown across conversations before any network action.
 perform 1 from chat_contacts where tenant_id=t and id=d.contact_id for update;
 select * into r from chat_agent_runs where tenant_id=t and id=d.run_id;
 select * into c from chat_channels where tenant_id=t and id=r.channel_id and is_active for share;
 select * into v from chat_conversations where tenant_id=t and id=d.conversation_id;
 if c.id is null or not exists(select 1 from chat_workspaces where tenant_id=t and id=c.workspace_id and status='active')
  or chat_supplemental_valid(t,d.id) is not true or v.quiet_until>now() or v.last_customer_at<now()-interval '24 hours'
  or exists(select 1 from chat_messages m join chat_messages trigger on trigger.tenant_id=t and trigger.id=r.trigger_message_id
   where m.tenant_id=t and m.conversation_id=d.conversation_id and m.author='customer' and not m.private and (m.created_at,m.chatwoot_message_id)>(trigger.created_at,trigger.chatwoot_message_id))
  then raise exception 'Supplemental eligibility changed';end if;
 if not staff and not exists(select 1 from chat_channel_action_approvals a join tenant_users u on u.tenant_id=t and u.id=a.approved_by and u.status='active' and u.role='owner_admin'
  where a.tenant_id=t and a.channel_id=c.id and a.pack_id=d.pack_id and a.approved_at is not null and c.agent_mode='auto') then raise exception 'Supplemental approval changed';end if;
 if p_action='claim' then
  if d.state<>'draft' then return jsonb_build_object('status',d.state);end if;
  update chat_supplemental_deliveries set state='sending' where tenant_id=t and id=d.id;
 elsif d.state<>'sending' then raise exception 'Supplemental already claimed';end if;
 return jsonb_build_object('status','claimed','id',d.id,'kind',d.kind,'text',d.text,'assetUrl',d.asset_url,'workspaceId',c.workspace_id,
  'accountId',(select chatwoot_account_id from chat_workspaces where tenant_id=t and id=c.workspace_id),'conversationId',v.chatwoot_conversation_id);
end $$;
commit;
