-- All configuration writes and audit events share one transaction.
begin;
create function public.chat_configure(p_context jsonb, p_action text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_tenant uuid := (p_context->>'tenantId')::uuid;
 v_actor text := p_context#>>'{actor,id}';
 v_key text := p_context->>'idempotencyKey';
 v_hash text; v_previous public.command_idempotency%rowtype;
 v_id uuid; v_result jsonb; v_brand uuid; v_location uuid; v_pack jsonb;
 v_audit jsonb := '{}'::jsonb; v_before boolean;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or
    nullif(btrim(v_actor),'') is null or nullif(btrim(v_key),'') is null or
    nullif(btrim(p_context->>'correlationId'),'') is null or p_context->>'source' is distinct from 'OS_PLUS_UI' then
  raise exception 'Invalid chat command context';
 end if;
 -- Serialize tenant configuration including first-use inserts and version allocation.
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||v_tenant::text,0));
 if not exists(select 1 from tenants t join tenant_users u on u.tenant_id=t.id
   join tenant_modules m on m.tenant_id=t.id and m.module_key='chat_leads'
   where t.id=v_tenant and t.status='active' and u.clerk_user_id=v_actor
   and u.status='active' and u.role='owner_admin' and m.is_enabled) then
  raise exception 'Chat access denied';
 end if;
 v_hash:=encode(digest(jsonb_build_object('action',p_action,'input',case when p_action='channel.map' then p_input-'name' else p_input end,'actor',v_actor,'source',p_context->>'source')::text,'sha256'),'hex');
 select * into v_previous from command_idempotency where tenant_id=v_tenant and command_type='chat.configure' and idempotency_key=v_key;
 if found then
  if v_previous.request_hash<>v_hash then raise exception 'Idempotency key reused'; end if;
  if v_previous.status='completed' then return v_previous.result_json; end if;
  raise exception 'Chat command pending';
 end if;
 -- Authorized receipt lookup lets a lost response replay before state-dependent server validation.
 if coalesce((p_context->>'replayOnly')::boolean,false) then return null; end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash) values(v_tenant,'chat.configure',v_key,v_hash);
 case p_action
 when 'brand.save' then
  v_id:=nullif(p_input->>'id','')::uuid;
  if v_id is null then
   insert into chat_brands(tenant_id,name,slug,persona_name,created_by,updated_by)
   values(v_tenant,p_input->>'name',p_input->>'slug',p_input->>'personaName',v_actor,v_actor) returning id into v_id;
  else
   update chat_brands set name=p_input->>'name',slug=p_input->>'slug',persona_name=p_input->>'personaName',updated_by=v_actor
   where tenant_id=v_tenant and id=v_id and deleted_at is null;
   if not found then raise exception 'Chat record unavailable'; end if;
  end if;

 when 'branch.map' then
  v_brand:=(p_input->>'brandId')::uuid; v_location:=(p_input->>'locationId')::uuid;
  perform 1 from chat_brands where tenant_id=v_tenant and id=v_brand and is_active and deleted_at is null for update;
  if not found then raise exception 'Chat brand unavailable'; end if;
  perform 1 from tenant_locations where tenant_id=v_tenant and id=v_location and is_active and deleted_at is null for share;
  if not found then raise exception 'Chat branch unavailable'; end if;
  insert into chat_brand_locations(tenant_id,brand_id,location_id,created_by,updated_by)
  values(v_tenant,v_brand,v_location,v_actor,v_actor)
  on conflict(tenant_id,brand_id,location_id) do update set updated_by=v_actor returning id into v_id;
 when 'pack.save' then
  v_brand:=(p_input->>'brandId')::uuid; v_pack:=p_input->'pack';
  perform 1 from chat_brands where tenant_id=v_tenant and id=v_brand and is_active and deleted_at is null for update;
  if not found then raise exception 'Chat brand unavailable'; end if;
  insert into chat_knowledge_packs(tenant_id,brand_id,version,pack_json,created_by,updated_by)
  select v_tenant,v_brand,coalesce(max(version),0)+1,v_pack,v_actor,v_actor
  from chat_knowledge_packs where tenant_id=v_tenant and brand_id=v_brand returning id into v_id;
 when 'pack.publish' then
  v_id:=(p_input->>'id')::uuid;
  select brand_id,pack_json into v_brand,v_pack from chat_knowledge_packs where tenant_id=v_tenant and id=v_id and status='draft' for update;
  if not found then raise exception 'Draft knowledge pack unavailable'; end if;
  perform 1 from chat_brands where tenant_id=v_tenant and id=v_brand and is_active and deleted_at is null for update;
  if not found then raise exception 'Chat brand unavailable'; end if;
  -- Capabilities are intentionally not activated in CH-1.
  if v_pack ? 'booking' then raise exception 'Booking capability not enabled'; end if;
  -- Lock mapped branch facts while checking publication so an archive cannot race it.
  perform l.id from tenant_locations l join chat_brand_locations b on b.tenant_id=l.tenant_id and b.location_id=l.id
  where b.tenant_id=v_tenant and b.brand_id=v_brand for share of l;
  if exists(select 1 from jsonb_array_elements(v_pack->'areas') pack_area(value) where not exists(
   select 1 from tenant_locations l join chat_brand_locations b on b.tenant_id=l.tenant_id and b.location_id=l.id
   where b.tenant_id=v_tenant and b.brand_id=v_brand and l.is_active and l.deleted_at is null and lower(l.code)=lower(pack_area.value->>'locationCode')
  )) then raise exception 'Chat branch unavailable'; end if;
  update chat_knowledge_packs set status='archived',updated_by=v_actor where tenant_id=v_tenant and brand_id=v_brand and status='published';
  update chat_knowledge_packs set status='published',published_at=now(),published_by=v_actor,updated_by=v_actor where tenant_id=v_tenant and id=v_id;


 when 'role.grant' then
  select allowed into v_before from chat_role_permissions where tenant_id=v_tenant and role=p_input->>'role' and permission=p_input->>'permission';
  v_audit:=jsonb_build_object('role',p_input->>'role','permission',p_input->>'permission','beforeAllowed',coalesce(v_before,false),'allowed',(p_input->>'allowed')::boolean);
  insert into chat_role_permissions(tenant_id,role,permission,allowed,created_by,updated_by)
  values(v_tenant,p_input->>'role',p_input->>'permission',(p_input->>'allowed')::boolean,v_actor,v_actor)
  on conflict(tenant_id,role,permission) do update set allowed=excluded.allowed,updated_by=v_actor returning id into v_id;
 when 'channel.map' then
  v_brand:=(p_input->>'brandId')::uuid; v_location:=nullif(p_input->>'locationId','')::uuid;
  perform 1 from chat_workspaces where tenant_id=v_tenant and id=(p_input->>'workspaceId')::uuid and status<>'suspended' for update;
  if not found then raise exception 'Chat workspace unavailable'; end if;
  perform 1 from chat_brands where tenant_id=v_tenant and id=v_brand and is_active and deleted_at is null for update;
  if not found then raise exception 'Chat brand unavailable'; end if;
  if v_location is not null then
   perform 1 from tenant_locations where tenant_id=v_tenant and id=v_location and is_active and deleted_at is null for share;
   if not found then raise exception 'Chat branch unavailable'; end if;
  end if;
  insert into chat_channels(tenant_id,workspace_id,brand_id,default_location_id,chatwoot_inbox_id,kind,name,created_by,updated_by)
  values(v_tenant,(p_input->>'workspaceId')::uuid,v_brand,v_location,(p_input->>'inboxId')::bigint,p_input->>'kind',p_input->>'name',v_actor,v_actor)
  on conflict(tenant_id,workspace_id,chatwoot_inbox_id) do update
  set brand_id=excluded.brand_id,default_location_id=excluded.default_location_id,kind=excluded.kind,name=excluded.name,updated_by=v_actor returning id into v_id;


 when 'brand.archive' then
  v_id:=(p_input->>'id')::uuid;
  update chat_brands set is_active=false,deleted_at=now(),updated_by=v_actor where tenant_id=v_tenant and id=v_id and deleted_at is null;
  if not found then raise exception 'Chat record unavailable'; end if;
  update chat_channels set is_active=false,agent_mode='off',updated_by=v_actor where tenant_id=v_tenant and brand_id=v_id;
 else raise exception 'Unsupported chat command';
 end case;
 v_result:=jsonb_build_object('id',v_id);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(v_tenant,'chat.'||p_action,'chat_configuration',v_id,'USER',v_actor,p_context->>'source',p_context->>'correlationId',v_audit);
 update command_idempotency set status='completed',result_json=v_result,completed_at=now()
 where tenant_id=v_tenant and command_type='chat.configure' and idempotency_key=v_key;
 return v_result;
end;
$$;
revoke all on function public.chat_configure(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_configure(jsonb,text,jsonb) to service_role;

-- This service-only entry point is called exclusively after requireSuperAdmin().
-- Tenant users never receive a service key or a caller-controlled platform privilege flag.
create function public.chat_platform_configure(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_tenant uuid:=(p_context->>'tenantId')::uuid;
 v_actor text:=p_context#>>'{actor,id}';
 v_key text:=p_context->>'idempotencyKey';
 v_hash text; v_previous command_idempotency%rowtype;
 v_id uuid; v_workspace chat_workspaces%rowtype; v_result jsonb; v_logical jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or nullif(btrim(v_actor),'') is null
 or nullif(btrim(v_key),'') is null or nullif(btrim(p_context->>'correlationId'),'') is null
 or p_context->>'source' is distinct from 'OS_PLUS_UI' then raise exception 'Invalid chat command context'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||v_tenant::text,0));
 if not exists(select 1 from tenants where id=v_tenant and status='active') then raise exception 'Chat tenant unavailable'; end if;
 -- Random one-time material is not the caller's logical request identity.
 v_logical:=case p_action
 when 'workspace.prepare' then p_input-'id'-'workspaceKey'-'secretHash'
 when 'workspace.rotate' then p_input-'secretHash'
 when 'workspace.link' then p_input-'apiTokenEnc'
 else p_input end;
 v_hash:=encode(digest(jsonb_build_object('action',p_action,'input',v_logical,'actor',v_actor)::text,'sha256'),'hex');
 select * into v_previous from command_idempotency where tenant_id=v_tenant and command_type='chat.platform.configure' and idempotency_key=v_key;
 if found then
  if v_previous.request_hash<>v_hash then raise exception 'Idempotency key reused'; end if;
  if p_action='workspace.reserve' then return v_previous.result_json||jsonb_build_object('claimed',false); end if;
  if v_previous.status='completed' then return v_previous.result_json||jsonb_build_object('replayed',true); end if;
  raise exception 'Chat command pending';
 end if;
 if coalesce((p_context->>'replayOnly')::boolean,false) then return null; end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash) values(v_tenant,'chat.platform.configure',v_key,v_hash);
 if p_action<>'workspace.prepare' then
  select * into v_workspace from chat_workspaces where tenant_id=v_tenant for update;
  if not found then raise exception 'Chat workspace unavailable'; end if;
  v_id:=v_workspace.id;
  if p_input ? 'id' and (p_input->>'id')::uuid is distinct from v_id then raise exception 'Chat workspace unavailable'; end if;
 end if;
 case p_action
 when 'workspace.prepare' then
  v_id:=(p_input->>'id')::uuid;
  insert into chat_workspaces(id,tenant_id,chatwoot_base_url,workspace_key,webhook_secret_hash,created_by,updated_by)
  values(v_id,v_tenant,p_input->>'origin',p_input->>'workspaceKey',p_input->>'secretHash',v_actor,v_actor);
  insert into chat_settings(tenant_id,created_by,updated_by) values(v_tenant,v_actor,v_actor) on conflict(tenant_id) do nothing;
  insert into tenant_modules(tenant_id,created_by,updated_by) values(v_tenant,v_actor,v_actor) on conflict(tenant_id,module_key) do nothing;
 when 'workspace.reserve' then
  if v_workspace.provisioning_attempted_at is not null or v_workspace.chatwoot_account_id is not null or v_workspace.status<>'pending' then
   raise exception 'Reconcile the pending account before another creation attempt';
  end if;
  update chat_workspaces set provisioning_attempted_at=now(),updated_by=v_actor where tenant_id=v_tenant and id=v_id;
  v_result:=jsonb_build_object('claimed',true);
 when 'workspace.record' then
  if v_workspace.provisioning_attempted_at is null or v_workspace.status<>'pending' or
   (v_workspace.chatwoot_account_id is not null and v_workspace.chatwoot_account_id<>(p_input->>'accountId')::bigint)
   then raise exception 'Chat account mismatch'; end if;
  update chat_workspaces set chatwoot_account_id=(p_input->>'accountId')::bigint,updated_by=v_actor where tenant_id=v_tenant and id=v_id;
 when 'workspace.link' then
  if v_workspace.chatwoot_account_id is not null and v_workspace.chatwoot_account_id<>(p_input->>'accountId')::bigint then raise exception 'Chat account mismatch'; end if;
  update chat_workspaces set chatwoot_account_id=(p_input->>'accountId')::bigint,api_token_enc=p_input->>'apiTokenEnc',status='active',updated_by=v_actor
  where tenant_id=v_tenant and id=v_id;
 when 'workspace.rotate' then
  update chat_workspaces set webhook_secret_hash=p_input->>'secretHash',updated_by=v_actor where tenant_id=v_tenant and id=v_id;
 when 'workspace.suspend' then
  update chat_workspaces set status='suspended',updated_by=v_actor where tenant_id=v_tenant and id=v_id;
  update tenant_modules set is_enabled=false,updated_by=v_actor where tenant_id=v_tenant and module_key='chat_leads';
 when 'module.set' then
  if (p_input->>'enabled')::boolean and v_workspace.status='suspended' then raise exception 'Chat workspace suspended'; end if;
  insert into tenant_modules(tenant_id,is_enabled,enabled_at,enabled_by,created_by,updated_by)
  values(v_tenant,(p_input->>'enabled')::boolean,now(),v_actor,v_actor,v_actor)
  on conflict(tenant_id,module_key) do update set is_enabled=excluded.is_enabled,enabled_at=excluded.enabled_at,enabled_by=v_actor,updated_by=v_actor;
 else raise exception 'Unsupported platform chat command';
 end case;
 v_result:=coalesce(v_result,'{}'::jsonb)||jsonb_build_object('id',v_id);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(v_tenant,'chat.'||p_action,'chat_workspace',v_id,'USER',v_actor,'OS_PLUS_UI',p_context->>'correlationId',
 case when p_action='module.set' then jsonb_build_object('enabled',(p_input->>'enabled')::boolean) else '{}'::jsonb end);
 update command_idempotency set status='completed',result_json=v_result,completed_at=now()
 where tenant_id=v_tenant and command_type='chat.platform.configure' and idempotency_key=v_key;
 return v_result;
end;
$$;
revoke all on function public.chat_platform_configure(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_platform_configure(jsonb,text,jsonb) to service_role;

commit;
