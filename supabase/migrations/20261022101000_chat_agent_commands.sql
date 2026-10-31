-- CH-5 owner-authorized sandbox audit only. Agent commands are added in verified increments.
begin;
create function public.chat_agent_command(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; member tenant_users; old chat_sandbox_turns;
 brand uuid; command_key uuid; result jsonb;
begin
 if jsonb_typeof(p_context) is distinct from 'object' or jsonb_typeof(p_input) is distinct from 'object'
 or length(coalesce(p_context->>'correlationId','')) not between 1 and 200 or octet_length(p_input::text)>245000
 then raise exception 'Agent command unavailable'; end if;
 perform 1 from tenants where id=t and status='active' for share;
 if not found then raise exception 'Agent command unavailable'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled for share;
 if not found then raise exception 'Agent command unavailable'; end if;
 if p_action in ('sandbox.record','sandbox.replay') then
  if p_context#>>'{actor,type}' is distinct from 'USER' or p_context->>'source' is distinct from 'OS_PLUS_UI'
  or p_input-array['brandId','commandKey','requestHash','result']<>'{}'::jsonb then raise exception 'Sandbox unavailable'; end if;
  select * into member from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
  if not found then raise exception 'Sandbox unavailable'; end if;
  brand:=(p_input->>'brandId')::uuid; command_key:=(p_input->>'commandKey')::uuid;result:=p_input->'result';
  if coalesce(p_input->>'requestHash','')!~'^[a-f0-9]{64}$' then raise exception 'Sandbox request unavailable';end if;
  if p_action='sandbox.replay' then
   perform 1 from chat_brands where tenant_id=t and id=brand and is_active and deleted_at is null;
   if not found then raise exception 'Sandbox unavailable';end if;
   select * into old from chat_sandbox_turns s where s.tenant_id=t and s.command_key=(p_input->>'commandKey')::uuid;
   if not found then return null;end if;
   if old.brand_id<>brand or old.actor_tenant_user_id<>member.id or old.request_hash<>p_input->>'requestHash' then raise exception 'Sandbox retry changed';end if;
   return jsonb_build_object('id',old.id,'result',old.result_json);
  end if;
  if brand is null or command_key is null or jsonb_typeof(result) is distinct from 'object'
  or result-array['outcome','replyText','costUsd','models','packVersion','understanding','checks','provenance','timingsMs','mode','decision','ledger']<>'{}'::jsonb
  or coalesce(result->>'outcome','') not in ('drafted','silent','handoff','fallback','error')
  or result->>'costUsd' is null or result->>'costUsd'!~'^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$'
  or length(coalesce(result->>'replyText',''))>6000
  or jsonb_typeof(result->'models') is distinct from 'array'
  or jsonb_typeof(result->'understanding') is distinct from 'object'
  or jsonb_typeof(result->'checks') is distinct from 'array'
  or jsonb_typeof(result->'provenance') is distinct from 'array'
  or jsonb_typeof(result->'timingsMs') is distinct from 'object'
  then raise exception 'Sandbox result unavailable'; end if;
  perform 1 from chat_brands where tenant_id=t and id=brand and is_active for share;
  if not found then raise exception 'Sandbox unavailable'; end if;
  -- Serialize the receipt before reading it; an altered retry must never replace its original result.
  perform pg_advisory_xact_lock(hashtextextended(t::text||command_key::text,0));
  -- Qualified alias below avoids PL/pgSQL column/variable ambiguity.
  select * into old from chat_sandbox_turns s where s.tenant_id=t and s.command_key=(p_input->>'commandKey')::uuid;
  if found then
   if old.brand_id<>brand or old.request_hash<>p_input->>'requestHash' or old.result_json<>result or old.actor_tenant_user_id<>member.id then raise exception 'Sandbox retry changed'; end if;
   return jsonb_build_object('id',old.id);
  end if;
  insert into chat_sandbox_turns(tenant_id,brand_id,actor_tenant_user_id,command_key,request_hash,correlation_id,result_json)
  values(t,brand,member.id,command_key,p_input->>'requestHash',p_context->>'correlationId',result) returning id into brand;
  return jsonb_build_object('id',brand);
 end if;
 raise exception 'Agent command unavailable';
end $$;
revoke all on function public.chat_agent_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_command(jsonb,text,jsonb) to service_role;
commit;

-- No browser credentials and no unscoped reads. Called only by authenticated webhook/server orchestration.
begin;
create function public.chat_agent_load(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; w chat_workspaces; c chat_channels; conv chat_conversations;
 m chat_messages; pack chat_knowledge_packs; history jsonb; complete boolean; ledger jsonb; background jsonb; locations jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot'
 or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
 or jsonb_typeof(p_input) is distinct from 'object'
 or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId']<>'{}'::jsonb
 then raise exception 'Agent context unavailable'; end if;
 perform 1 from tenants where id=t and status='active';
 if not found then raise exception 'Agent context unavailable'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled;
 if not found then raise exception 'Agent context unavailable'; end if;
 select * into w from chat_workspaces where tenant_id=t and id=(p_input->>'workspaceId')::uuid
 and status='active' and webhook_secret_hash=p_input->>'secretHash';
 if not found then raise exception 'Agent context unavailable'; end if;
 select * into c from chat_channels where tenant_id=t and workspace_id=w.id and id=(p_input->>'channelId')::uuid and is_active and agent_mode<>'off';
 if not found then raise exception 'Agent context unavailable'; end if;
 perform 1 from chat_brands where tenant_id=t and id=c.brand_id and is_active and deleted_at is null;
 if not found then raise exception 'Agent context unavailable'; end if;
 select * into conv from chat_conversations where tenant_id=t and channel_id=c.id and id=(p_input->>'conversationId')::uuid;
 if not found then raise exception 'Agent context unavailable'; end if;
 select * into m from chat_messages where tenant_id=t and conversation_id=conv.id and id=(p_input->>'triggerMessageId')::uuid and author='customer' and not private;
 if not found then raise exception 'Agent context unavailable'; end if;
 select * into pack from chat_knowledge_packs where tenant_id=t and brand_id=c.brand_id and status='published' order by version desc limit 1;
 if not found then raise exception 'Agent knowledge unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenantId',t,'conversationId',conv.id,'id',h.id,'providerId',h.chatwoot_message_id,
  'author',h.author,'private',false,'content',h.content,'at',h.created_at) order by h.created_at,h.chatwoot_message_id),'[]'::jsonb),
  count(*)<=500 into history,complete
 from (select id,chatwoot_message_id,author,content,created_at from chat_messages
  where tenant_id=t and conversation_id=conv.id and not private and author<>'system'
  order by created_at desc,chatwoot_message_id desc limit 501) h;
 select jsonb_build_object('tenantId',t,'contactId',person.id,'displayName',left(person.display_name,200),
  'preferredLanguage',left(person.prefs_json->>'language',40),
  'customer',(select jsonb_build_object('tenantId',t,'id',cu.id,'verified',true,'name',left(cu.name,200),
   'addresses',coalesce((select jsonb_agg(a) from (select left(label,200) label,left(address_line_1,2000) line,left(area,200) area,left(city,200) city
    from customer_addresses where tenant_id=t and customer_id=cu.id and deleted_at is null order by is_default desc,id limit 5) a),'[]'::jsonb),
   'orders',coalesce((select jsonb_agg(o) from (select order_status status,order_date::text at from orders
    where tenant_id=t and customer_id=cu.id and deleted_at is null and order_status not in ('draft','cancelled') order by order_date desc,id desc limit 20) o),'[]'::jsonb),
   'openTasks',(select count(*) from tasks where tenant_id=t and subject_type='customer' and subject_id=cu.id and status not in ('completed','cancelled')))
   from customers cu where cu.tenant_id=t and cu.id=person.customer_id and cu.deleted_at is null
    and exists(select 1 from chat_contact_identities ident where ident.tenant_id=t and ident.contact_id=person.id
     and ident.kind='phone' and ident.verified and ident.value=cu.normalized_phone_e164)))
 into background from chat_contacts person where person.tenant_id=t and person.id=conv.contact_id and person.merged_into is null and person.deleted_at is null;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into locations from (
  select t "tenantId",c.brand_id "brandId",left(l.code,100) code,left(l.name,200) name,
   left(concat_ws(', ',l.address_line_1,l.address_line_2,l.area,l.city,l.state,l.postal_code),2000) address,
   b.map_url "mapUrl",b.lat,b.lng,b.is_primary "primary",coalesce(l.id=c.default_location_id,false) "default"
  from chat_brand_locations b join tenant_locations l on l.tenant_id=t and l.id=b.location_id
  where b.tenant_id=t and b.brand_id=c.brand_id and l.is_active and l.deleted_at is null order by b.is_primary desc,b.sort_order,l.code limit 101) x;
 select ledger_json into ledger from chat_state where tenant_id=t and conversation_id=conv.id;
 return jsonb_build_object('tenantId',t,'workspaceId',w.id,'channelId',c.id,'conversationId',conv.id,'triggerMessageId',m.id,
  'brandId',c.brand_id,'active',true,'moduleEnabled',true,'channelKind',c.kind,'agentMode',c.agent_mode,'quietUntil',conv.quiet_until,
  'background',background,'locations',locations,'currency',(select default_currency from chat_settings where tenant_id=t),
  'quietMinutes',coalesce((select quiet_minutes from chat_settings where tenant_id=t),60),
  'ledger',coalesce(ledger,'{}'::jsonb),'historyComplete',complete,'messages',history,
  'pack',jsonb_build_object('tenantId',t,'brandId',c.brand_id,'version',pack.version,'body',pack.pack_json));
end $$;
revoke all on function public.chat_agent_load(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_load(jsonb,jsonb) to service_role;
commit;

begin;
create function public.chat_agent_run(p_context jsonb,p_action text,p_input jsonb)
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
 if p_action in ('complete','delivery.claim','delivery.record','delivery.uncertain') then return chat_agent_finish(p_context,p_action,p_input,loaded); end if;
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
 and conversation_id=(p_input->>'conversationId')::uuid and channel_id=(p_input->>'channelId')::uuid
 and trigger_message_id=(p_input->>'triggerMessageId')::uuid for update;
 if not found or p_input->>'callKey' not in ('understand','classify','write','rewrite') or p_input->>'callKey' is null
 then raise exception 'Agent reservation unavailable'; end if;
 if p_action='budget.reserve' then
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
revoke all on function public.chat_agent_run(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_run(jsonb,text,jsonb) to service_role;
commit;

begin;
create function public.chat_agent_finish(p_context jsonb,p_action text,p_input jsonb,p_loaded jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
 t uuid:=(p_context->>'tenantId')::uuid;r chat_agent_runs;v jsonb:=p_input->'result';latest uuid;pack chat_knowledge_packs;
 l leads;priorities jsonb;intent text;services text[];area text;handoff boolean;canonical_cost numeric;
begin
 -- Internal only: chat_agent_run has authenticated scope and holds the tenant configuration lock.
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
 and conversation_id=(p_input->>'conversationId')::uuid and channel_id=(p_input->>'channelId')::uuid
 and trigger_message_id=(p_input->>'triggerMessageId')::uuid for update;
 if not found or r.lease_token is distinct from (p_input->>'leaseToken')::uuid then raise exception 'Agent lease unavailable'; end if;
 if p_action='complete' then
  if jsonb_typeof(v) is distinct from 'object' or v-array['mode','outcome','replyText','costUsd','packVersion','understanding','decision','checks','provenance','models','timingsMs','ledger']<>'{}'::jsonb
  or coalesce(v->>'mode','')<>'draft' or coalesce(v->>'outcome','') not in ('drafted','silent','handoff','fallback','error')
  or length(coalesce(v->>'replyText',''))>6000 or coalesce((v->>'packVersion')::integer,0)<>r.pack_version
  or jsonb_typeof(v->'understanding') is distinct from 'object' or jsonb_typeof(v->'decision') is distinct from 'object'
  or jsonb_typeof(v->'checks') is distinct from 'array' or jsonb_typeof(v->'models') is distinct from 'array'
  or jsonb_typeof(v->'provenance') is distinct from 'array' or jsonb_typeof(v->'timingsMs') is distinct from 'object'
  then raise exception 'Invalid draft result'; end if;
  if r.result_json is not null then
   if (r.result_json-'costUsd')<>(v-'costUsd') then raise exception 'Draft retry changed'; end if;
   return jsonb_build_object('status',r.status);
  end if;
  if r.status<>'running' or r.lease_until<=now() then raise exception 'Agent lease expired'; end if;
  if exists(select 1 from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state<>'settled')
  then return jsonb_build_object('status','cost_pending'); end if;
 end if;
 if p_action='delivery.claim' and r.status<>'ready' then
  return jsonb_build_object('status',case when r.status='delivering' then 'delivering_existing' else r.status end);
 end if;
 if p_action in ('complete','delivery.claim') then
  select id into latest from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private order by created_at desc,chatwoot_message_id desc limit 1;
  select * into pack from chat_knowledge_packs where tenant_id=t and brand_id=(p_loaded->>'brandId')::uuid and status='published' order by version desc limit 1;
  if latest is distinct from r.trigger_message_id or (p_loaded->>'quietUntil')::timestamptz>now() or pack.id is distinct from r.pack_id then
   update chat_agent_runs set status='finished',updated_at=now() where tenant_id=t and id=r.id;
   update chat_turns set outcome='silent',reply_text=null,decision_json=jsonb_build_object('reason','superseded_or_changed') where tenant_id=t and id=r.turn_id;
   return jsonb_build_object('status','superseded');
  end if;
 end if;
 if p_action='complete' then
  select coalesce(sum(actual_usd),0) into canonical_cost from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state='settled';
  v:=jsonb_set(v,'{costUsd}',to_jsonb(canonical_cost::text));
  update chat_agent_runs set result_json=v,status=case when v->>'replyText' is null then 'finished' else 'ready' end,updated_at=now()
   where tenant_id=t and id=r.id returning * into r;
  update chat_turns set engine='osplus-v1',knowledge_pack_version=r.pack_version,mode='draft',outcome=v->>'outcome',
   understanding_json=v->'understanding',decision_json=(v->'decision')||jsonb_build_object('sources',v->'provenance','delivery',case when r.status='ready' then 'pending' else 'none' end),
   reply_text=v->>'replyText',checks_json=v->'checks',models_json=v->'models',cost_usd=canonical_cost,timings_ms_json=v->'timingsMs',error=null
   where tenant_id=t and id=r.turn_id;
  -- Enrichment cannot change kind/stage/customer/owner, or manufacture bookings/payments/consent.
  if v->>'outcome'<>'silent' and nullif(v#>>'{understanding,gist}','') is not null then
   if (v->'understanding')-array['intent','services','language','gist','signals','slots','confidence']<>'{}'::jsonb
   or length(v#>>'{understanding,gist}')>2000 or jsonb_typeof(v#>'{understanding,services}') is distinct from 'array'
   or not (pack.pack_json#>'{brand,languages}') ? (v#>>'{understanding,language}')
   then raise exception 'Unsupported lead enrichment'; end if;
   priorities:=coalesce(pack.pack_json#>'{crm,intentPriorities}','{}'::jsonb);
   intent:=v#>>'{understanding,intent}';
   if intent is not null and not priorities ? intent then raise exception 'Undeclared lead intent'; end if;
   if exists(select 1 from jsonb_array_elements_text(v#>'{understanding,services}') wanted(service_key)
    where not exists(select 1 from jsonb_array_elements(pack.pack_json->'services') defined(service) where defined.service->>'key'=wanted.service_key))
   then raise exception 'Undeclared lead service'; end if;
   select * into l from leads where tenant_id=t and conversation_id=r.conversation_id and closed_at is null for update;
   if found then
    if l.intent is not null and (intent is null or not priorities ? l.intent or (priorities->>intent)::integer<=(priorities->>l.intent)::integer) then intent:=l.intent;end if;
    select coalesce(array_agg(distinct value),'{}'::text[]) into services from (
     select unnest(l.services) value union all select jsonb_array_elements_text(v#>'{understanding,services}')) choices;
    select slot->>'value' into area from jsonb_array_elements(coalesce(v#>'{understanding,slots}','[]'::jsonb)) slot where slot->>'key'='area' limit 1;
    handoff:=coalesce((v#>>'{decision,handoff}')::boolean,false) or l.handoff;
    if l.intent is distinct from intent or l.services is distinct from services or l.gist is distinct from v#>>'{understanding,gist}'
     or (area is not null and l.area is distinct from area) or l.handoff is distinct from handoff then
     update leads set intent=intent,services=services,area=coalesce(area,l.area),gist=v#>>'{understanding,gist}',handoff=handoff,version=version+1
      where tenant_id=t and id=l.id;
     perform chat_lead_event(p_context,l.id,'enriched',jsonb_build_object('turnId',r.turn_id));

    end if;
   end if;
  end if;
  if v ? 'ledger' then
   if jsonb_typeof(v->'ledger') is distinct from 'object'
    or (v->'ledger')-array['schemaVersion','sessionStartedAt','requestOpen','vendorQuietUntil','language','handoff']<>'{}'::jsonb
    or v#>>'{ledger,schemaVersion}' is distinct from '1'
    or jsonb_typeof(v#>'{ledger,requestOpen}') is distinct from 'boolean'
    or jsonb_typeof(v#>'{ledger,handoff}') is distinct from 'boolean'
    or not exists(select 1 from jsonb_array_elements(p_loaded->'messages') msg
      where (msg->>'at')::timestamptz=(v#>>'{ledger,sessionStartedAt}')::timestamptz)
    or (v#>>'{ledger,language}' is not null and not (pack.pack_json#>'{brand,languages}') ? (v#>>'{ledger,language}'))
    then raise exception 'Invalid inquiry ledger'; end if;
   if v#>>'{ledger,vendorQuietUntil}' is not null then
    perform (v#>>'{ledger,vendorQuietUntil}')::timestamptz;
   end if;
   insert into chat_state(tenant_id,conversation_id,ledger_json) values(t,r.conversation_id,v->'ledger')
    on conflict(tenant_id,conversation_id) do update set ledger_json=excluded.ledger_json;
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
    values(t,'chat.agent.turn_completed','chat_conversation',r.conversation_id,p_context#>>'{actor,type}',p_context#>>'{actor,id}',
     p_context->>'source',p_context->>'correlationId',jsonb_build_object('turnId',r.turn_id));
  end if;
  -- A failed understanding has no gist; handoff still needs independent, monotonic auditing.
  if coalesce((v#>>'{decision,handoff}')::boolean,false) then
   select * into l from leads where tenant_id=t and conversation_id=r.conversation_id and closed_at is null for update;
   if found and not l.handoff then
    update leads set handoff=true,version=version+1 where tenant_id=t and id=l.id;
    perform chat_lead_event(p_context,l.id,'enriched',jsonb_build_object('turnId',r.turn_id));
   end if;
  end if;
  return jsonb_build_object('status',r.status);
 elsif p_action='delivery.claim' then
  if r.status<>'ready' then return jsonb_build_object('status',case when r.status='delivering' then 'delivering_existing' else r.status end); end if;
  update chat_agent_runs set status='delivering',updated_at=now() where tenant_id=t and id=r.id;
  return jsonb_build_object('status','delivering','replyText',r.result_json->>'replyText','draftId',r.id);
 elsif p_action='delivery.uncertain' then
  if r.status not in ('delivering','uncertain') then raise exception 'Delivery receipt unavailable'; end if;
  update chat_agent_runs set status='uncertain',updated_at=now() where tenant_id=t and id=r.id;
  update chat_turns set decision_json=decision_json||'{"delivery":"uncertain"}'::jsonb where tenant_id=t and id=r.turn_id;
  return jsonb_build_object('status','uncertain');
 elsif p_action='delivery.record' then
  if coalesce(p_input->>'providerNoteId','')!~'^[1-9][0-9]{0,14}$' then raise exception 'Invalid delivery receipt';end if;
  if r.status='delivered' then
   if r.delivery_note_id<>(p_input->>'providerNoteId')::bigint then raise exception 'Delivery retry changed';end if;
   return jsonb_build_object('status','delivered');
  end if;
  if r.status<>'delivering' then raise exception 'Delivery receipt unavailable';end if;
  update chat_agent_runs set status='delivered',delivery_note_id=(p_input->>'providerNoteId')::bigint,updated_at=now() where tenant_id=t and id=r.id;
  update chat_turns set decision_json=decision_json||'{"delivery":"posted_private_note"}'::jsonb where tenant_id=t and id=r.turn_id;
  return jsonb_build_object('status','delivered');
 end if;
 raise exception 'Invalid draft action';
end $$;
revoke all on function public.chat_agent_finish(jsonb,text,jsonb,jsonb) from public,anon,authenticated,service_role;
commit;

begin;
create function public.chat_agent_dry_run(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;loaded jsonb;v jsonb:=p_input->'result';turn chat_turns;scope jsonb;
begin
 if jsonb_typeof(p_input) is distinct from 'object'
 or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','result']<>'{}'::jsonb
 or octet_length(p_input::text)>245000 then raise exception 'Dry-run unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 scope:=p_input-'result';loaded:=chat_agent_load(p_context,scope);
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and config_json->>'agentEnabled'='true' and is_enabled;
 if not found then raise exception 'Agent disabled';end if;
 select * into turn from chat_turns where tenant_id=t and trigger_message_id=(p_input->>'triggerMessageId')::uuid for update;
 if not found then raise exception 'Dry-run turn unavailable';end if;
 if turn.decision_json->>'reason' is distinct from 'engine_not_enabled' then return jsonb_build_object('status','existing');end if;
 if v is null then return null;end if;
 if jsonb_typeof(v) is distinct from 'object' or v->>'costUsd' is distinct from '0' or v->>'mode' is distinct from 'draft'
 or coalesce(v->>'outcome','') not in ('drafted','silent','handoff','fallback','error')
 or length(coalesce(v->>'replyText',''))>6000 or (v->>'packVersion')::integer is distinct from (loaded#>>'{pack,version}')::integer
 or jsonb_typeof(v->'understanding') is distinct from 'object' or jsonb_typeof(v->'decision') is distinct from 'object'
 or jsonb_typeof(v->'checks') is distinct from 'array' or jsonb_typeof(v->'models') is distinct from 'array'
 or jsonb_typeof(v->'timingsMs') is distinct from 'object' then raise exception 'Invalid dry-run result';end if;
 update chat_turns set engine='osplus-v1',knowledge_pack_version=(v->>'packVersion')::integer,
 mode='draft',outcome=v->>'outcome',understanding_json=v->'understanding',
 decision_json=(v->'decision')||jsonb_build_object('sources',v->'provenance')||'{"dryRun":true,"delivery":"none"}'::jsonb,
 reply_text=v->>'replyText',checks_json=v->'checks',models_json=v->'models',cost_usd=0,timings_ms_json=v->'timingsMs',error=null
 where tenant_id=t and id=turn.id;
 return jsonb_build_object('status','recorded');
end $$;
revoke all on function public.chat_agent_dry_run(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_dry_run(jsonb,jsonb) to service_role;
commit;

begin;
create function public.chat_agent_target(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;loaded jsonb;r chat_agent_runs;w chat_workspaces;conv chat_conversations;latest uuid;pack chat_knowledge_packs;
begin
 if jsonb_typeof(p_input) is distinct from 'object' or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','runId','leaseToken']<>'{}'::jsonb
 then raise exception 'Draft target unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 loaded:=chat_agent_load(p_context,p_input-array['runId','leaseToken']);
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled and config_json->>'agentEnabled'='true';
 if not found then raise exception 'Agent disabled';end if;
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
 and conversation_id=(p_input->>'conversationId')::uuid and channel_id=(p_input->>'channelId')::uuid
 and trigger_message_id=(p_input->>'triggerMessageId')::uuid and lease_token=(p_input->>'leaseToken')::uuid and status='delivering';
 if not found then raise exception 'Draft no longer current';end if;
 select * into pack from chat_knowledge_packs where tenant_id=t and brand_id=(loaded->>'brandId')::uuid and status='published';
 if (loaded->>'quietUntil')::timestamptz>now() or r.pack_id is distinct from pack.id then raise exception 'Draft no longer current';end if;
 select id into latest from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private order by created_at desc,chatwoot_message_id desc limit 1;
 if latest is distinct from r.trigger_message_id then raise exception 'Draft no longer current';end if;
 select * into w from chat_workspaces where tenant_id=t and id=(p_input->>'workspaceId')::uuid;
 select * into conv from chat_conversations where tenant_id=t and id=r.conversation_id and channel_id=r.channel_id;
 return jsonb_build_object('accountId',w.chatwoot_account_id,'conversationId',conv.chatwoot_conversation_id,
  'triggerProviderId',(select chatwoot_message_id from chat_messages where tenant_id=t and id=r.trigger_message_id),'knowledgeVersion',r.pack_version);
end $$;
revoke all on function public.chat_agent_target(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_target(jsonb,jsonb) to service_role;
commit;
