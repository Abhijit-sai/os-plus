begin;
create function chat_voice_settings(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; s chat_settings; old command_idempotency;h text;k text:=p_context->>'idempotencyKey';result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner access required';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or p_input-array['version','enabled','maxBytes','maxSeconds']<>'{}'::jsonb then raise exception 'Invalid voice settings';end if;
 if p_input<>'{}'::jsonb then
  if nullif(k,'') is null or length(k)>160 or jsonb_typeof(p_input->'enabled') is distinct from 'boolean'
   or jsonb_typeof(p_input->'version') is distinct from 'number' or jsonb_typeof(p_input->'maxBytes') is distinct from 'number' or jsonb_typeof(p_input->'maxSeconds') is distinct from 'number'
   or (p_input->>'maxBytes')::numeric not between 1024 and 10000000 or (p_input->>'maxSeconds')::numeric not between 1 and 120
   or (p_input->>'maxBytes')::numeric<>trunc((p_input->>'maxBytes')::numeric) or (p_input->>'maxSeconds')::numeric<>trunc((p_input->>'maxSeconds')::numeric)
   then raise exception 'Invalid voice limits';end if;
  h:=encode(digest(jsonb_build_array(p_input,p_context#>>'{actor,id}')::text,'sha256'),'hex');
  select * into old from command_idempotency where tenant_id=t and command_type='CHAT_VOICE_SETTINGS' and idempotency_key=k;
  if found then if old.request_hash<>h or old.status<>'completed' then raise exception 'Voice settings retry changed';end if;return old.result_json;end if;
 end if;
 select * into s from chat_settings where tenant_id=t for update;
 if not found then raise exception 'Voice settings unavailable';end if;
 if p_input<>'{}'::jsonb then
  if s.voice_version is distinct from (p_input->>'version')::integer then raise exception 'Voice settings changed; reload';end if;
  update chat_settings set voice_enabled=(p_input->>'enabled')::boolean,voice_max_bytes=(p_input->>'maxBytes')::integer,voice_max_seconds=(p_input->>'maxSeconds')::integer,
   voice_version=voice_version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t returning * into s;
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.voice.settings_saved','chat_settings',s.id,'USER',p_context#>>'{actor,id}',p_context->>'source',p_context->>'correlationId',p_input-'version');
 end if;
 result:=jsonb_build_object('enabled',s.voice_enabled,'maxBytes',s.voice_max_bytes,'maxSeconds',s.voice_max_seconds,'version',s.voice_version);
 if p_input<>'{}'::jsonb then insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at) values(t,'CHAT_VOICE_SETTINGS',k,h,'completed',result,now());end if;
 return result;
end $$;
revoke all on function chat_voice_settings(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_voice_settings(jsonb,jsonb) to service_role;
commit;

begin;
create function chat_voice_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;scope jsonb;r chat_agent_runs;j chat_voice_jobs;m chat_messages;s chat_settings;loaded jsonb;item jsonb;audio_count int;total_count int;why text;body text;result jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'WEBHOOK' or p_context#>>'{actor,id}' is distinct from 'chatwoot' or p_context->>'source' is distinct from 'WEBHOOK'
 or nullif(btrim(p_context->>'correlationId'),'') is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>30000
 or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','runId','leaseToken','text','sha256','durationMs','bytes','language','providerNoteId']<>'{}'::jsonb
 or p_action is null or p_action not in ('claim','check','record','unreadable','note.claim','note.record','note.uncertain') then raise exception 'Voice command unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 scope:=jsonb_build_object('workspaceId',p_input->'workspaceId','secretHash',p_input->'secretHash','channelId',p_input->'channelId','conversationId',p_input->'conversationId','triggerMessageId',p_input->'triggerMessageId');
 select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid and channel_id=(p_input->>'channelId')::uuid and conversation_id=(p_input->>'conversationId')::uuid and trigger_message_id=(p_input->>'triggerMessageId')::uuid for update;
 if not found or r.lease_token is distinct from (p_input->>'leaseToken')::uuid then raise exception 'Voice lease unavailable';end if;
 perform 1 from chat_channels c join chat_workspaces w on w.tenant_id=t and w.id=c.workspace_id where c.tenant_id=t and c.id=r.channel_id and w.id=(p_input->>'workspaceId')::uuid and w.webhook_secret_hash=p_input->>'secretHash';
 if not found then raise exception 'Voice scope unavailable';end if;
 select * into j from chat_voice_jobs where tenant_id=t and trigger_message_id=r.trigger_message_id for update;
 -- Receipts may arrive after revocation/lease expiry; only the original sending capability can settle them.
 if p_action in ('note.record','note.uncertain') then
  if j.id is null or j.run_id<>r.id then raise exception 'Voice receipt unavailable';end if;
  if j.note_state='sent' and p_action='note.record' and j.provider_note_id=(p_input->>'providerNoteId')::bigint then return jsonb_build_object('status','sent');end if;
  if j.note_state<>'sending' then raise exception 'Voice receipt changed';end if;
  if p_action='note.record' then
   if coalesce(p_input->>'providerNoteId','')!~'^[1-9][0-9]*$' then raise exception 'Voice note receipt invalid';end if;
   update chat_voice_jobs set note_state='sent',provider_note_id=(p_input->>'providerNoteId')::bigint,updated_at=now() where tenant_id=t and id=j.id returning * into j;
  else update chat_voice_jobs set note_state='uncertain',updated_at=now() where tenant_id=t and id=j.id returning * into j;end if;
 else
  loaded:=chat_agent_load(p_context,scope);
  select * into s from chat_settings where tenant_id=t;
  if not s.voice_enabled then return jsonb_build_object('status','disabled');end if;
  if j.id is not null and j.settings_version<>s.voice_version then
   if j.note_state not in ('sending','sent','uncertain') then update chat_voice_jobs set state='cancelled',updated_at=now() where tenant_id=t and id=j.id;end if;
   return jsonb_build_object('status','settings_changed');
  end if;
  perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled and config_json->>'agentEnabled'='true';
  if not found then return jsonb_build_object('status','disabled');end if;
  if r.status<>'running' or r.lease_until<=now() then return jsonb_build_object('status','expired');end if;
  if (loaded->>'quietUntil')::timestamptz>now() or r.trigger_message_id is distinct from (select id from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private order by created_at desc,chatwoot_message_id desc limit 1)
   or r.pack_id is distinct from (select id from chat_knowledge_packs where tenant_id=t and brand_id=(loaded->>'brandId')::uuid and status='published' order by version desc limit 1)
  then if j.id is not null and j.note_state not in ('sending','sent','uncertain') then update chat_voice_jobs set state='cancelled',updated_at=now() where tenant_id=t and id=j.id;end if;return jsonb_build_object('status','superseded');end if;
  select * into m from chat_messages where tenant_id=t and conversation_id=r.conversation_id and id=r.trigger_message_id and author='customer' and not private;
  if not found then raise exception 'Voice source unavailable';end if;
  if p_action='claim' then
   if j.id is not null then return jsonb_build_object('status',case when j.note_state='sent' then 'sent' when j.state='unreadable' then 'unreadable' when j.state='ready' and j.note_state='pending' then 'ready' else 'held' end);end if;
   select count(*),count(*) filter(where x->>'file_type'='audio') into total_count,audio_count from jsonb_array_elements(m.attachments_json) x;
   if audio_count=0 then return jsonb_build_object('status','not_audio');end if;
   select x into item from jsonb_array_elements(m.attachments_json) x where x->>'file_type'='audio' limit 1;
   insert into chat_voice_jobs(tenant_id,conversation_id,trigger_message_id,run_id,attachment_id,settings_version,state)
    values(t,r.conversation_id,r.trigger_message_id,r.id,(item->>'id')::bigint,s.voice_version,case when total_count=1 and audio_count=1 then 'processing' else 'unreadable' end) returning * into j;
  elsif p_action in ('record','unreadable') then
   if j.id is null or j.state<>'processing' or j.note_state<>'none' then raise exception 'Voice result changed';end if;
   if p_action='unreadable' then update chat_voice_jobs set state='unreadable',updated_at=now() where tenant_id=t and id=j.id returning * into j;
   else
    if nullif(btrim(p_input->>'text'),'') is null or length(p_input->>'text')>6000 or coalesce(p_input->>'sha256','')!~'^[a-f0-9]{64}$'
     or jsonb_typeof(p_input->'durationMs') is distinct from 'number' or (p_input->>'durationMs')::numeric not between 0.001 and s.voice_max_seconds*1000
     or jsonb_typeof(p_input->'bytes') is distinct from 'number' or (p_input->>'bytes')::numeric not between 1 and s.voice_max_bytes or (p_input->>'bytes')::numeric<>trunc((p_input->>'bytes')::numeric)
     or not (loaded#>'{pack,body,brand,languages}') ? (p_input->>'language') then raise exception 'Voice result invalid';end if;
    update chat_messages set transcript=p_input->>'text' where tenant_id=t and id=m.id;
    update chat_voice_jobs set state='ready',note_state='pending',sha256=p_input->>'sha256',duration_ms=(p_input->>'durationMs')::numeric,data_bytes=(p_input->>'bytes')::integer,language=p_input->>'language',updated_at=now() where tenant_id=t and id=j.id returning * into j;
   end if;
  elsif p_action='note.claim' then
   if j.id is null or j.state<>'ready' or j.note_state<>'pending' then return jsonb_build_object('status','held');end if;
   update chat_voice_jobs set note_state='sending',updated_at=now() where tenant_id=t and id=j.id returning * into j;
  elsif p_action='check' then if j.id is null or j.state not in ('processing','ready') or j.note_state='uncertain' then return jsonb_build_object('status','held');end if;
  end if;
 end if;
 if p_action<>'check' then
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.voice.'||p_action,'chat_conversation',r.conversation_id,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('jobId',j.id,'messageId',r.trigger_message_id,'state',j.state,'noteState',j.note_state));end if;
 result:=jsonb_build_object('status',case when p_action='note.claim' then 'sending' when p_action in ('note.record','note.uncertain') then j.note_state else j.state end,'jobId',j.id);
 if p_action in ('claim','check','note.claim') then
  result:=result||jsonb_build_object('accountId',(select w.chatwoot_account_id from chat_channels c join chat_workspaces w on w.tenant_id=t and w.id=c.workspace_id where c.tenant_id=t and c.id=r.channel_id),
   'conversationId',(select chatwoot_conversation_id from chat_conversations where tenant_id=t and id=r.conversation_id),
   'providerMessageId',(select chatwoot_message_id from chat_messages where tenant_id=t and id=r.trigger_message_id),'attachmentId',j.attachment_id,
   'maxBytes',s.voice_max_bytes,'maxSeconds',s.voice_max_seconds,'languages',loaded#>'{pack,body,brand,languages}');
  if p_action='note.claim' then result:=result||jsonb_build_object('text',(select transcript from chat_messages where tenant_id=t and id=r.trigger_message_id));end if;
 end if;
 return result;
end $$;
revoke all on function chat_voice_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_voice_command(jsonb,text,jsonb) to service_role;
commit;
