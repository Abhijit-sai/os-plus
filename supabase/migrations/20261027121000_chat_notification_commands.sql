begin;
create function chat_notification_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; actor text:=p_context#>>'{actor,id}'; key text:=p_context->>'idempotencyKey';
 h text; old command_idempotency%rowtype; v chat_notification_targets%rowtype; result jsonb; ev text[]; brands uuid[]; settings chat_settings%rowtype;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=actor and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner access required';end if;
 if key is null or length(key) not between 1 and 160 or p_action is null or p_action not in ('create','issue','save','settings')
  or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid notification command';end if;
 -- Random encryption/code material is excluded from the logical retry identity, never returned in audit.
 h:=encode(digest(jsonb_build_object('action',p_action,'input',case when p_action='issue' then p_input-'codeHash'-'codeEnc' else p_input end,'actor',actor,'source',p_context->>'source')::text,'sha256'),'hex');
 select * into old from command_idempotency where tenant_id=t and command_type='CHAT_NOTIFICATION' and idempotency_key=key;
 if found then
  if old.request_hash<>h or old.status<>'completed' then raise exception 'Notification command conflict';end if;
  return old.result_json;
 end if;
 if p_action='settings' then
  if jsonb_typeof(p_input->'enabled') is distinct from 'boolean' or p_input->>'localTime' is null or p_input->>'localTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or p_input->>'timezone' is null or not exists(select 1 from pg_timezone_names where name=p_input->>'timezone')
   then raise exception 'Invalid reporting schedule';end if;
  select * into settings from chat_settings where tenant_id=t for update;
  if not found or settings.notification_version is distinct from (p_input->>'version')::integer then raise exception 'Schedule changed; reload';end if;
  update chat_settings set notifications_enabled=(p_input->>'enabled')::boolean,timezone=p_input->>'timezone',
   summary_local_time=(p_input->>'localTime')::time,notification_version=notification_version+1,updated_by=actor
   where tenant_id=t returning * into settings;
  result:=jsonb_build_object('id',settings.id,'version',settings.notification_version);
 elsif p_action='create' then
  if nullif(btrim(p_input->>'label'),'') is null or length(p_input->>'label')>80 then raise exception 'Choose a destination label';end if;
  insert into chat_notification_targets(id,tenant_id,label,created_by,updated_by)
  values((p_input->>'id')::uuid,t,btrim(p_input->>'label'),actor,actor) returning * into v;
 else
  select * into v from chat_notification_targets where tenant_id=t and id=(p_input->>'id')::uuid for update;
  if not found or v.version is distinct from (p_input->>'version')::integer then raise exception 'Destination changed; reload';end if;
  if p_action='issue' then
   if p_input->>'codeHash' is null or p_input->>'codeHash' !~ '^[a-f0-9]{64}$' or p_input->>'codeEnc' is null
    or p_input->>'codeEnc' !~ '^gcm1[.]' or length(p_input->>'codeEnc')>12000 then raise exception 'Invalid link material';end if;
   update chat_notification_targets set version=version+1,is_active=false,events='{}',recipient_enc=null,recipient_kind=null,
    recipient_hint=null,linked_at=null,confirmed_at=null,activated_at=null,telegram_chat_id=null,
    link_code_hash=p_input->>'codeHash',link_code_enc=p_input->>'codeEnc',link_code_expires_at=now()+interval '30 minutes',updated_by=actor
    where tenant_id=t and id=v.id returning * into v;
  else
   if nullif(btrim(p_input->>'label'),'') is null or length(p_input->>'label')>80
    or jsonb_typeof(p_input->'events') is distinct from 'array' or jsonb_array_length(p_input->'events')>6
    or jsonb_typeof(p_input->'brandIds') is distinct from 'array' or jsonb_array_length(p_input->'brandIds')>100
    or jsonb_typeof(p_input->'active') is distinct from 'boolean' or jsonb_typeof(p_input->'confirm') is distinct from 'boolean'
    then raise exception 'Invalid destination settings';end if;
   select coalesce(array_agg(distinct value),'{}') into ev from jsonb_array_elements_text(p_input->'events');
   select coalesce(array_agg(distinct value::uuid),'{}') into brands from jsonb_array_elements_text(p_input->'brandIds');
   if not ev <@ array['booking_request','handoff','payment_claim','agent_failure','daily_summary','new_lead']::text[] or array_position(ev,null) is not null
    then raise exception 'Invalid events';end if;
   perform 1 from chat_brands where tenant_id=t and id=any(brands) and is_active and deleted_at is null for share;
   if (select count(*) from chat_brands where tenant_id=t and id=any(brands) and is_active and deleted_at is null)<>cardinality(brands)
    then raise exception 'Brand unavailable';end if;
   if (p_input->>'active')::boolean and (v.recipient_enc is null or v.linked_at is null or (v.confirmed_at is null and not (p_input->>'confirm')::boolean))
    then raise exception 'Confirm the linked destination first';end if;
   if (p_input->>'active')::boolean and 'daily_summary'=any(ev) and v.recipient_kind is distinct from 'private'
    then raise exception 'Daily reports require a private owner destination';end if;
   update chat_notification_targets set version=version+1,label=btrim(p_input->>'label'),events=ev,is_active=(p_input->>'active')::boolean,
    confirmed_at=case when (p_input->>'confirm')::boolean and linked_at is not null then now() else confirmed_at end,
    activated_at=case when (p_input->>'active')::boolean then now() else null end,updated_by=actor
    where tenant_id=t and id=v.id returning * into v;
   delete from chat_notification_target_brands where tenant_id=t and target_id=v.id;
   insert into chat_notification_target_brands(tenant_id,target_id,brand_id,created_by,updated_by)
    select t,v.id,x,actor,actor from unnest(brands) x;
  end if;
 end if;
 if p_action<>'settings' then result:=jsonb_build_object('id',v.id,'version',v.version);end if;
 if p_action='issue' then result:=result||jsonb_build_object('codeEnc',v.link_code_enc,'expiresAt',v.link_code_expires_at);end if;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.notification.'||p_action,case when p_action='settings' then 'chat_settings' else 'chat_notification_target' end,(result->>'id')::uuid,'USER',actor,'OS_PLUS_UI',p_context->>'correlationId',
  case when p_action='settings' then jsonb_build_object('version',settings.notification_version,'enabled',settings.notifications_enabled,'timezone',settings.timezone,'localTime',p_input->>'localTime') else jsonb_build_object('version',v.version,'active',v.is_active,'events',v.events) end);
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_NOTIFICATION',key,h,'completed',result,now());
 return result;
end $$;
revoke all on function chat_notification_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_notification_command(jsonb,text,jsonb) to service_role;

create function chat_notification_link(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; v chat_notification_targets%rowtype;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'telegram'
  or p_context->>'source' is distinct from 'WEBHOOK' or nullif(btrim(p_context->>'correlationId'),'') is null
  then raise exception 'Invalid link context';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants a join tenant_modules m on m.tenant_id=a.id and m.module_key='chat_leads' and m.is_enabled
  where a.id=t and a.status='active' for share of a,m;
 if not found then return jsonb_build_object('claimed',false);end if;
 if p_input->>'codeHash' is null or p_input->>'codeHash' !~ '^[a-f0-9]{64}$' or p_input->>'recipientEnc' is null
  or p_input->>'recipientEnc' !~ '^gcm1[.]' or length(p_input->>'recipientEnc')>12000
  or p_input->>'kind' is null or p_input->>'kind' not in ('private','group','supergroup')
  or p_input->>'hint' is null or p_input->>'hint' !~ '^[0-9]{1,4}$' or (p_input->>'updateId')::numeric<0
  or (p_input->>'updateId')::numeric>9007199254740991 then raise exception 'Invalid link claim';end if;
 select * into v from chat_notification_targets where tenant_id=t and id=(p_input->>'id')::uuid
  and link_code_hash=p_input->>'codeHash' and link_code_expires_at>clock_timestamp() for update;
 if not found then return jsonb_build_object('claimed',false);end if;
 update chat_notification_targets set version=version+1,recipient_enc=p_input->>'recipientEnc',recipient_kind=p_input->>'kind',
  recipient_hint=p_input->>'hint',linked_at=now(),is_active=false,confirmed_at=null,activated_at=null,
  link_code_hash=null,link_code_enc=null,link_code_expires_at=null,telegram_chat_id=null,updated_by='telegram'
  where tenant_id=t and id=v.id;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.notification.linked','chat_notification_target',v.id,'WEBHOOK','telegram','WEBHOOK',p_context->>'correlationId',
  jsonb_build_object('kind',p_input->>'kind','version',v.version+1));
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function chat_notification_link(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_notification_link(jsonb,jsonb) to service_role;
create function chat_notification_read(p_context jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner access required';end if;
 select jsonb_build_object(
  'settings',(select jsonb_build_object('version',notification_version,'enabled',notifications_enabled,'timezone',timezone,'localTime',to_char(summary_local_time,'HH24:MI')) from chat_settings where tenant_id=t),
  'targets',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'version',n.version,'label',n.label,'active',n.is_active,'events',n.events,
   'linked',n.linked_at is not null,'confirmed',n.confirmed_at is not null,'kind',n.recipient_kind,'hint',n.recipient_hint,'expiresAt',n.link_code_expires_at,
   'brandIds',coalesce((select jsonb_agg(brand_id order by brand_id) from chat_notification_target_brands where tenant_id=t and target_id=n.id),'[]'::jsonb)) order by n.created_at,n.id)
   from chat_notification_targets n where n.tenant_id=t),'[]'::jsonb),
  'deliveries',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'target',x.label,'kind',x.kind,'status',x.state,'at',x.created_at,'sentAt',x.sent_at) order by x.created_at desc,x.id) from (
   select o.id,n.label,o.kind,o.state,o.created_at,o.sent_at from chat_notification_outbox o join chat_notification_targets n on n.tenant_id=t and n.id=o.target_id
   where o.tenant_id=t order by o.created_at desc,o.id limit 20
  ) x),'[]'::jsonb),
  'brands',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from chat_brands where tenant_id=t and is_active and deleted_at is null),'[]'::jsonb)
 ) into result;return result;
end $$;
revoke all on function chat_notification_read(jsonb) from public,anon,authenticated;
grant execute on function chat_notification_read(jsonb) to service_role;

create function chat_notification_resolve(p_hash text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('tenantId',n.tenant_id,'id',n.id) from chat_notification_targets n
 join tenants t on t.id=n.tenant_id and t.status='active'
 join tenant_modules m on m.tenant_id=t.id and m.module_key='chat_leads' and m.is_enabled
 where p_hash ~ '^[a-f0-9]{64}$' and n.link_code_hash=p_hash and n.link_code_expires_at>now();
$$;
revoke all on function chat_notification_resolve(text) from public,anon,authenticated;
grant execute on function chat_notification_resolve(text) to service_role;
commit;
