begin;
create function public.chat_capabilities(p_context jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; result jsonb:='["follow_up_task"]';
begin
 t:=chat_lead_authorize(p_context);
 if exists(select 1 from tenant_verticals tv join vertical_definitions v on v.id=tv.vertical_definition_id
  where tv.tenant_id=t and tv.is_enabled and v.is_active and v.key='laundry') then result:=result||'["laundry_pickup"]'::jsonb; end if;
 return result;
end $$;
revoke all on function public.chat_capabilities(jsonb) from public,anon,authenticated;
grant execute on function public.chat_capabilities(jsonb) to service_role;

-- Dedicated publication preserves the CH-1 command body and its receipt format.
-- Its authorised replay path shares the existing tenant lock; no rename or privilege expansion.
create function public.chat_publish_action_pack(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid;actor text:=p_context#>>'{actor,id}';key text:=p_context->>'idempotencyKey';
 result jsonb; p chat_knowledge_packs%rowtype;h text;cap text;
begin
 result:=chat_configure(p_context||'{"replayOnly":true}'::jsonb,'pack.publish',p_input);
 if result is not null then return result; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or not p_input ? 'id'
  or exists(select 1 from jsonb_object_keys(p_input) k where k<>'id') then raise exception 'Invalid publication input'; end if;
 select * into p from chat_knowledge_packs where tenant_id=t and id=(p_input->>'id')::uuid and status='draft' for update;
 if not found then raise exception 'Draft knowledge pack unavailable'; end if;
 perform 1 from chat_brands where tenant_id=t and id=p.brand_id and is_active and deleted_at is null for update;
 if not found then raise exception 'Chat brand unavailable'; end if;
 cap:=p.pack_json#>>'{booking,capability}';
 if p.pack_json ? 'booking' then
  if cap is null or cap not in ('follow_up_task','laundry_pickup') then raise exception 'Unsupported booking capability'; end if;
  if cap='laundry_pickup' then perform assert_laundry_vertical_enabled(t); end if;
 end if;
 perform l.id from tenant_locations l join chat_brand_locations b on b.tenant_id=l.tenant_id and b.location_id=l.id
  where b.tenant_id=t and b.brand_id=p.brand_id for share of l;
 if exists(select 1 from jsonb_array_elements(p.pack_json->'areas') pack_area(value) where not exists(
  select 1 from tenant_locations l join chat_brand_locations b on b.tenant_id=l.tenant_id and b.location_id=l.id
  where b.tenant_id=t and b.brand_id=p.brand_id and l.is_active and l.deleted_at is null and lower(l.code)=lower(pack_area.value->>'locationCode')
 )) then raise exception 'Chat branch unavailable'; end if;
 h:=encode(digest(jsonb_build_object('action','pack.publish','input',p_input,'actor',actor,'source',p_context->>'source')::text,'sha256'),'hex');
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash)
 values(t,'chat.configure',key,h);
 update chat_knowledge_packs set status='archived',updated_by=actor where tenant_id=t and brand_id=p.brand_id and status='published';
 update chat_knowledge_packs set status='published',published_at=now(),published_by=actor,updated_by=actor where tenant_id=t and id=p.id;
 result:=jsonb_build_object('id',p.id);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.pack.publish','chat_configuration',p.id,'USER',actor,p_context->>'source',p_context->>'correlationId',jsonb_build_object('capability',cap));
 update command_idempotency set status='completed',result_json=result,completed_at=now()
 where tenant_id=t and command_type='chat.configure' and idempotency_key=key;
 return result;
end $$;
revoke all on function public.chat_publish_action_pack(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_publish_action_pack(jsonb,jsonb) to service_role;
commit;
