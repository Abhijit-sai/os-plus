begin;
-- Internal detail validation is repeated at the SQL trust boundary; no arbitrary model JSON is executable.
create function public.chat_request_details_valid(x jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare k text;
begin
 if x is null or jsonb_typeof(x)<>'object' or octet_length(x::text)>20000 then return false; end if;
 if not x ?& array['name','services','area','address','date','window','timePreference']
  or exists(select 1 from jsonb_object_keys(x) v where v<>all(array['name','services','area','address','date','window','timePreference'])) then return false; end if;
 foreach k in array array['name','area','address','date','window','timePreference'] loop
  if jsonb_typeof(x->k) not in ('string','null') or (jsonb_typeof(x->k)='string' and length(btrim(x->>k)) not between 1 and 2000) then return false; end if;
 end loop;
 if jsonb_typeof(x->'services')<>'array' or jsonb_array_length(x->'services')>100 then return false; end if;
 if exists(select 1 from jsonb_array_elements(x->'services') s where jsonb_typeof(s)<>'string' or s#>>'{}' !~ '^[a-z][a-z0-9_]{0,63}$') then return false; end if;
 if (select count(*)<>count(distinct v) from jsonb_array_elements_text(x->'services') v) then return false; end if;
 return true;
end $$;
revoke all on function public.chat_request_details_valid(jsonb) from public,anon,authenticated,service_role;

create function public.chat_request_store(p_context jsonb,p_action text,p_input jsonb) returns jsonb
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
  or strpos(coalesce(m.content,''),p_input->>'evidence')=0 then raise exception 'Customer request evidence unavailable'; end if;
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
revoke all on function public.chat_request_store(jsonb,text,jsonb) from public,anon,authenticated,service_role;
create function public.chat_action_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform chat_lead_authorize(p_context);
 return chat_request_store(p_context,p_action,p_input);
end $$;
revoke all on function public.chat_action_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_action_command(jsonb,text,jsonb) to service_role;
commit;
