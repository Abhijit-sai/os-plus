-- CH9: website profile numbers are unverified claims, never possession-backed identity keys.
begin;
create table public.chat_website_phone_claims (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 contact_id uuid not null, channel_id uuid not null, message_id uuid not null,
 value text not null check(value ~ '^\+[1-9][0-9]{7,14}$'),
 verified boolean not null default false check(not verified),
 source text not null default 'website_prechat' check(source='website_prechat'),
 created_at timestamptz not null,
 unique(tenant_id,id),unique(tenant_id,message_id),
 foreign key(tenant_id,contact_id) references public.chat_contacts(tenant_id,id),
 foreign key(tenant_id,channel_id) references public.chat_channels(tenant_id,id),
 foreign key(tenant_id,message_id) references public.chat_messages(tenant_id,id)
);
create index chat_website_claim_contact on public.chat_website_phone_claims(tenant_id,contact_id,created_at desc);
alter table public.chat_website_phone_claims enable row level security;
revoke all on public.chat_website_phone_claims from public,anon,authenticated,service_role;
grant select on public.chat_website_phone_claims to service_role;
alter function public.chat_capture(jsonb,text,jsonb) rename to chat_capture_before_website;
revoke all on function public.chat_capture_before_website(jsonb,text,jsonb) from public,anon,authenticated,service_role;
create function public.chat_capture(p_context jsonb,p_kind text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid; result jsonb; cv chat_conversations; ch chat_channels; m chat_messages;
 claim_value text:=p_input#>>'{identity,websitePhoneClaimE164}'; saved public.chat_website_phone_claims; new_id uuid;
begin
 -- Existing capture owns workspace URL-key/secret resolution, scope checks, the tenant lock and every earlier phase.
 result:=chat_capture_before_website(p_context,p_kind,p_input);
 if claim_value is null or result->>'messageId' is null then return result;end if;
 select * into m from chat_messages where tenant_id=t and id=(result->>'messageId')::uuid;
 select * into cv from chat_conversations where tenant_id=t and id=m.conversation_id;
 select * into ch from chat_channels where tenant_id=t and id=cv.channel_id;
 if ch.kind<>'website' or m.author<>'customer' or m.private then return result;end if;
 if claim_value !~ '^\+[1-9][0-9]{7,14}$' or cv.contact_id is null then raise exception 'Invalid website phone claim';end if;
 select * into saved from chat_website_phone_claims where tenant_id=t and message_id=m.id;
 if found then
  if saved.value is distinct from claim_value then raise exception 'Website claim replay changed';end if;
  return result;
 end if;
 insert into chat_website_phone_claims(tenant_id,contact_id,channel_id,message_id,value,created_at)
 values(t,cv.contact_id,ch.id,m.id,claim_value,m.created_at) returning id into new_id;
 -- The claim and capture roll back together if audit fails. No phone value is copied into event payloads.
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.website.phone_claimed','chat_contact',cv.contact_id,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('claimId',new_id,'messageId',m.id));
 return result;
end $$;
revoke all on function public.chat_capture(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_capture(jsonb,text,jsonb) to service_role;
commit;
