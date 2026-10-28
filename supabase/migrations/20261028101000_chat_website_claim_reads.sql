begin;
-- Keep the audited claim separate from unique verified identity keys. CRM exposes it only as unverified staff context.
alter function public.chat_crm_read(jsonb,text,jsonb) rename to chat_crm_read_before_website;
revoke all on function public.chat_crm_read_before_website(jsonb,text,jsonb) from public,anon,authenticated,service_role;
create function public.chat_crm_read(p_context jsonb,p_view text,p_input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; claims jsonb:='[]';t uuid:=(p_context->>'tenantId')::uuid;
begin
 result:=chat_crm_read_before_website(p_context,p_view,p_input);
 if p_view='contact' and jsonb_typeof(result->'item')='object' then
  if result#>>'{permissions,pii}'='true' then
   select coalesce(jsonb_agg(jsonb_build_object('value',c.value,'verified',false,'source','website_prechat') order by c.last_seen desc,c.value),'[]'::jsonb)
   into claims from (
    select claim.value,max(claim.created_at) last_seen from chat_website_phone_claims claim
    join chat_messages m on m.tenant_id=claim.tenant_id and m.id=claim.message_id
    join chat_conversations cv on cv.tenant_id=m.tenant_id and cv.id=m.conversation_id
    where claim.tenant_id=t and cv.contact_id=(p_input->>'id')::uuid
    group by claim.value order by max(claim.created_at) desc,claim.value limit 10
   ) c;
  end if;
  result:=jsonb_set(result,'{details,phoneClaims}',claims);
 end if;
 return result;
end $$;
revoke all on function public.chat_crm_read(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_crm_read(jsonb,text,jsonb) to service_role;
commit;
