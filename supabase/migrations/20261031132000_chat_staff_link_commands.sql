-- Staff setup only. Apply separately after the installed 106-file baseline.
-- Platform authorization and fresh native membership/identity verification are server responsibilities.
-- Browser roles cannot execute this service-only audited command or write the existing table.
begin;
create function public.chat_staff_link_configure(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid; actor text; key text; w chat_workspaces%rowtype; member tenant_users%rowtype;
 link chat_staff_links%rowtype; receipt command_idempotency%rowtype; h text; result jsonb;
 workspace_id uuid; profile_id uuid; account_id bigint; native_id bigint;
begin
 if jsonb_typeof(p_context) is distinct from 'object' or jsonb_typeof(p_input) is distinct from 'object'
 or p_context#>>'{actor,type}' is distinct from 'USER' or p_context->>'source' is distinct from 'OS_PLUS_UI'
 or nullif(btrim(p_context#>>'{actor,id}'),'') is null
 or length(p_context#>>'{actor,id}')>200
 or nullif(btrim(p_context->>'correlationId'),'') is null
 or length(p_context->>'idempotencyKey') not between 1 and 160
 or nullif(btrim(p_context->>'idempotencyKey'),'') is null
 or p_input-array['workspaceId','accountId','tenantUserId','chatwootUserId','profileFingerprint'] <> '{}'::jsonb
 or (p_input->>'profileFingerprint') is null or (p_input->>'profileFingerprint') !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_input->'accountId') is distinct from 'number'
 or jsonb_typeof(p_input->'chatwootUserId') is distinct from 'number'
 or (p_input->>'accountId') !~ '^[1-9][0-9]{0,15}$'
 or (p_input->>'chatwootUserId') !~ '^[1-9][0-9]{0,15}$'
 then raise exception 'Invalid staff-link command'; end if;
 t:=(p_context->>'tenantId')::uuid; actor:=p_context#>>'{actor,id}'; key:=p_context->>'idempotencyKey';
 workspace_id:=(p_input->>'workspaceId')::uuid; profile_id:=(p_input->>'tenantUserId')::uuid;
 account_id:=(p_input->>'accountId')::bigint; native_id:=(p_input->>'chatwootUserId')::bigint;
 if t is null or workspace_id is null or profile_id is null or account_id>9007199254740991 or native_id>9007199254740991 then raise exception 'Invalid staff-link scope';end if;
 -- Share the existing configuration lock, including workspace suspension/account changes.
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants where id=t and status='active' for share;
 if not found then raise exception 'Chat tenant unavailable';end if;
 select * into w from chat_workspaces where tenant_id=t and id=workspace_id and status='active' and chatwoot_account_id=account_id for share;
 if not found then raise exception 'Chat workspace unavailable';end if;
 select * into member from tenant_users where tenant_id=t and id=profile_id and status='active'
   and role in ('owner_admin','manager') and nullif(btrim(clerk_user_id),'') is not null and nullif(btrim(email),'') is not null for share;
 if not found or encode(sha256(convert_to(lower(btrim(member.email))||':'||member.clerk_user_id,'UTF8')),'hex') is distinct from p_input->>'profileFingerprint'
 then raise exception 'Staff profile unavailable or changed';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('actor',actor,'input',p_input)::text,'UTF8')),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='chat.staff.link' and idempotency_key=key;
 if found then
  if receipt.request_hash is distinct from h or receipt.status<>'completed' then raise exception 'Staff-link command conflict';end if;
  return receipt.result_json;
 end if;
 if coalesce((p_context->>'replayOnly')::boolean,false) then return null;end if;
 select * into link from chat_staff_links where tenant_id=t and (tenant_user_id=profile_id or chatwoot_user_id=native_id) for update;
 if found then
  if link.tenant_user_id<>profile_id or link.chatwoot_user_id<>native_id then raise exception 'Staff login is already linked';end if;
 else
  insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id,created_by,updated_by)
  values(t,profile_id,native_id,actor,actor) returning * into link;
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
  values(t,'chat.staff_linked','chat_staff_link',link.id,'USER',actor,'OS_PLUS_UI',p_context->>'correlationId',
   jsonb_build_object('workspaceId',workspace_id,'accountId',account_id,'tenantUserId',profile_id,'chatwootUserId',native_id));
 end if;
 result:=jsonb_build_object('id',link.id);
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'chat.staff.link',key,h,'completed',result,now());
 return result;
end $$;
revoke all on function public.chat_staff_link_configure(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_staff_link_configure(jsonb,jsonb) to service_role;
commit;
