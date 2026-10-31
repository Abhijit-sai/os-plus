begin;
create function chat_action_context(p_tenant uuid,p_conversation uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 select jsonb_build_object('tenantId',p_tenant,'brandId',l.brand_id,'canBook',c.can_book,
  'verifiedPhone',exists(select 1 from chat_contact_identities where tenant_id=p_tenant and contact_id=l.contact_id and kind='phone' and verified),
  'leadRef',l.ref_code,'whatsappNumber',coalesce(c.whatsapp_number_e164,(select min(whatsapp_number_e164) from chat_channels where tenant_id=p_tenant and brand_id=l.brand_id and kind='whatsapp' and is_active having count(whatsapp_number_e164)=1)),
  'request',(select jsonb_build_object('capability',r.capability,'status',r.status,'details',r.details_json) from chat_action_requests r
   where r.tenant_id=p_tenant and r.lead_id=l.id and r.status in ('requested','customer_confirmed','materialized') order by r.created_at desc,r.id desc limit 1)) into result
 from leads l join chat_channels c on c.tenant_id=p_tenant and c.id=l.channel_id where l.tenant_id=p_tenant and l.conversation_id=p_conversation and l.closed_at is null order by l.created_at desc,l.id desc limit 1;
 return result;
end $$;
revoke all on function chat_action_context(uuid,uuid) from public,anon,authenticated,service_role;
create function chat_action_agent_load(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare checked jsonb;
begin
 checked:=chat_agent_load(p_context,p_input);
 return checked||jsonb_build_object('actions',chat_action_context((p_context->>'tenantId')::uuid,(p_input->>'conversationId')::uuid));
end $$;
revoke all on function chat_action_agent_load(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_action_agent_load(jsonb,jsonb) to service_role;
commit;
