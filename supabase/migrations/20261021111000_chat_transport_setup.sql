begin;
-- Reservation/receipt ledger for external setup. A pending create is never blindly repeated.
-- Only the server's platform-admin command may call this service-role RPC.
create function public.chat_transport_setup(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; w chat_workspaces%rowtype;
 stage text:=p_input->>'stage'; h text:=p_input->>'requestHash'; k text;
 receipt command_idempotency%rowtype; remote_id bigint; result jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or nullif(btrim(p_context#>>'{actor,id}'),'') is null
 or p_context->>'source' is distinct from 'OS_PLUS_UI' or nullif(btrim(p_context->>'correlationId'),'') is null
 or p_action is null or p_action not in ('begin','complete','check')
 or stage is null or stage !~ '^(bot|webhook|inbox:[1-9][0-9]{0,15})$'
 or h is null or h !~ '^[a-f0-9]{64}$' then raise exception 'Invalid chat setup context'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants t0 join tenant_modules m on m.tenant_id=t0.id
 where t0.id=t and t0.status='active' and m.module_key='chat_leads' and m.is_enabled for share of t0,m;
 if not found then raise exception 'Chat access denied'; end if;
 select * into w from chat_workspaces where tenant_id=t and id=(p_input->>'workspaceId')::uuid
 and status='active' and webhook_secret_hash=p_input->>'secretHash' for update;
 if not found then raise exception 'Chat workspace unavailable'; end if;
 if stage like 'inbox:%' then
  perform 1 from chat_channels where tenant_id=t and workspace_id=w.id and is_active and agent_mode<>'off'
  and chatwoot_inbox_id=substring(stage from 7)::bigint for share;
  if not found then raise exception 'Chat inbox unavailable'; end if;
 end if;
 k:=w.id::text||':'||h||':'||stage;
 select * into receipt from command_idempotency where tenant_id=t and command_type='chat.transport.setup' and idempotency_key=k;
 if p_action='check' then
  if not found or receipt.status='completed' then raise exception 'Chat setup needs reconciliation'; end if;
  return jsonb_build_object('allowed',true);
 end if;
 if p_action='begin' then
  if found then return jsonb_build_object('started',false,'completedId',receipt.result_json->'id'); end if;
  insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash) values(t,'chat.transport.setup',k,h);
  result:=jsonb_build_object('started',true,'completedId',null);
 else
  if not found then raise exception 'Chat setup reservation missing'; end if;
  remote_id:=(p_input->>'remoteId')::bigint;
  if remote_id is null or remote_id<=0 or remote_id>9007199254740991 then raise exception 'Invalid remote id'; end if;
  if receipt.status='completed' then
   if (receipt.result_json->>'id')::bigint<>remote_id then raise exception 'Chat setup identity mismatch'; end if;
   return receipt.result_json;
  end if;
  if stage='bot' then
   if p_input->>'botTokenEnc' is null or p_input->>'botTokenEnc' not like 'gcm1.%' then raise exception 'Missing bot credential'; end if;
   if w.agent_bot_id is not null and w.agent_bot_id<>remote_id then raise exception 'Chat bot needs reconciliation'; end if;
   update chat_workspaces set agent_bot_id=remote_id,bot_token_enc=p_input->>'botTokenEnc' where tenant_id=t and id=w.id;
  end if;
  result:=jsonb_build_object('id',remote_id);
  update command_idempotency set status='completed',result_json=result,completed_at=now()
  where tenant_id=t and command_type='chat.transport.setup' and idempotency_key=k;
 end if;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.transport.'||p_action,'chat_workspace',w.id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('stage',stage));
 return result;
end $$;
revoke all on function public.chat_transport_setup(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_transport_setup(jsonb,text,jsonb) to service_role;
commit;
