-- CH-3: new tenant-owned CRM records. Existing business tables remain unchanged.
begin;
create table public.chat_contacts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 display_name text check(length(display_name)<=200), prefs_json jsonb not null default '{}' check(jsonb_typeof(prefs_json)='object'),
 notes text check(length(notes)<=10000), customer_id uuid, merged_into uuid,
 first_seen_at timestamptz not null, last_seen_at timestamptz not null,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by text, updated_by text, deleted_at timestamptz,
 unique(tenant_id,id), check(merged_into is null or merged_into<>id),
 foreign key(tenant_id,customer_id) references customers(tenant_id,id),
 foreign key(tenant_id,merged_into) references chat_contacts(tenant_id,id)
);
create table public.chat_contact_identities (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 contact_id uuid not null, kind text not null check(kind in ('phone','chatwoot_contact','instagram','facebook','web_visitor')),
 value text not null check(length(value) between 1 and 600), verified boolean not null,
 source text not null default 'chatwoot', created_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,kind,value),
 foreign key(tenant_id,contact_id) references chat_contacts(tenant_id,id),
 check(kind<>'phone' or value ~ '^\+[1-9][0-9]{6,14}$')
);
alter table chat_conversations add column contact_id uuid,
 add foreign key(tenant_id,contact_id) references chat_contacts(tenant_id,id);
create table public.leads (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 ref_code text not null check(ref_code ~ '^[2-9A-HJKMNP-Z]{5}$'),
 brand_id uuid not null, location_id uuid, channel_id uuid not null, channel_kind text not null check(channel_kind in ('whatsapp','instagram','facebook','website')),
 contact_id uuid not null, conversation_id uuid not null, customer_id uuid,
 kind text not null default 'sales' check(kind in ('sales','service','spam')), intent text, services text[] not null default '{}',
 area text, stage text not null default 'new' check(stage in ('new','engaged','booked','in_progress','won','lost')),
 lost_reason text, owner_tenant_user_id uuid, owner_source text check(owner_source in ('auto','manual')), est_value numeric check(est_value>=0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 gist text check(length(gist)<=4000), handoff boolean not null default false, notes text check(length(notes)<=10000),
 order_id uuid, booking_subject_type text, booking_subject_id uuid, booking_pickup_id uuid, booking_task_id uuid,
 first_customer_at timestamptz not null, first_response_at timestamptz, first_human_response_at timestamptz,
 last_customer_at timestamptz not null, last_reply_at timestamptz, closed_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text, updated_by text,
 unique(tenant_id,id), unique(tenant_id,ref_code),
 foreign key(tenant_id,brand_id) references chat_brands(tenant_id,id),
 foreign key(tenant_id,location_id) references tenant_locations(tenant_id,id),
 foreign key(tenant_id,channel_id) references chat_channels(tenant_id,id),
 foreign key(tenant_id,contact_id) references chat_contacts(tenant_id,id),
 foreign key(tenant_id,conversation_id) references chat_conversations(tenant_id,id),
 foreign key(tenant_id,customer_id) references customers(tenant_id,id),
 foreign key(tenant_id,owner_tenant_user_id) references tenant_users(tenant_id,id),
 foreign key(tenant_id,order_id) references orders(tenant_id,id),
 foreign key(tenant_id,booking_pickup_id) references laundry_pickup_requests(tenant_id,id),
 foreign key(tenant_id,booking_task_id) references tasks(tenant_id,id),
 check((stage in ('won','lost'))=(closed_at is not null)),
 check((booking_subject_type is null)=(booking_subject_id is null)),
 check((booking_subject_type is null and booking_pickup_id is null and booking_task_id is null)
  or (booking_subject_type='laundry_pickup_request' and booking_pickup_id is not null and booking_subject_id=booking_pickup_id and booking_task_id is null)
  or (booking_subject_type='task' and booking_task_id is not null and booking_subject_id=booking_task_id and booking_pickup_id is null))
);
create unique index leads_one_open_conversation on leads(tenant_id,conversation_id) where closed_at is null;
create index leads_stage_clock on leads(tenant_id,stage,last_customer_at desc);
create index leads_contact on leads(tenant_id,contact_id);
create table public.lead_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 lead_id uuid not null, at timestamptz not null default now(), kind text not null,
 from_value jsonb, to_value jsonb, actor_type text not null check(actor_type in ('USER','SYSTEM','AGENT','WEBHOOK')),
 actor_id text, source text not null, correlation_id text not null check(length(btrim(correlation_id))>0),
 meta_json jsonb not null default '{}', unique(tenant_id,id),
 foreign key(tenant_id,lead_id) references leads(tenant_id,id)
);
-- An exact-key collision requires a human decision; capturing must never merge existing people.
create table public.chat_identity_conflicts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 contact_id uuid not null, candidate_contact_id uuid not null, kind text not null, value text not null,
 created_at timestamptz not null default now(), unique(tenant_id,id),
 unique(tenant_id,contact_id,candidate_contact_id,kind,value),
 foreign key(tenant_id,contact_id) references chat_contacts(tenant_id,id),
 foreign key(tenant_id,candidate_contact_id) references chat_contacts(tenant_id,id),
 check(contact_id<>candidate_contact_id)
);
create table public.chat_lead_capture_receipts (
 tenant_id uuid not null references tenants(id) on delete cascade, message_id uuid not null,
 at timestamptz not null default now(), primary key(tenant_id,message_id),
 foreign key(tenant_id,message_id) references chat_messages(tenant_id,id)
);
create index lead_events_history on lead_events(tenant_id,lead_id,at,id);
create trigger lead_events_append_only before update or delete on lead_events for each row execute function prevent_domain_event_mutation();
do $$ declare tbl text; begin
 foreach tbl in array array['chat_contacts','chat_contact_identities','leads','lead_events','chat_identity_conflicts','chat_lead_capture_receipts'] loop
  execute format('alter table %I enable row level security',tbl);
  execute format('revoke all on %I from public,anon,authenticated,service_role',tbl);
  execute format('grant select on %I to service_role',tbl);
 end loop;
end $$;
create trigger chat_contacts_updated before update on chat_contacts for each row execute function set_updated_at();
create trigger leads_updated before update on leads for each row execute function set_updated_at();

-- Internal helper: caller must hold the tenant's configuration lock and have authorized context.
create function public.chat_lead_event(ctx jsonb,l uuid,k text,meta jsonb default '{}') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(ctx->>'tenantId')::uuid;
begin
 insert into lead_events(tenant_id,lead_id,kind,actor_type,actor_id,source,correlation_id,meta_json)
 values(t,l,k,ctx#>>'{actor,type}',ctx#>>'{actor,id}',ctx->>'source',ctx->>'correlationId',meta);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.lead.'||k,'lead',l,ctx#>>'{actor,type}',ctx#>>'{actor,id}',ctx->>'source',ctx->>'correlationId',meta);
end $$;
revoke all on function chat_lead_event(jsonb,uuid,text,jsonb) from public,anon,authenticated,service_role;

-- Estimate only: retained order history never authorizes lead stage progression.
create function public.chat_lead_value(t uuid,customer uuid,brand uuid,lead_kind text,currency_code text) returns numeric
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare median numeric; basket jsonb;
begin
 if lead_kind<>'sales' then return null; end if;
 select round((percentile_cont(0.5) within group(order by total_amount))::numeric,2) into median
 from orders where tenant_id=t and customer_id=customer and deleted_at is null and order_status not in ('draft','cancelled')
  and source_currency_code=currency_code and total_amount between 0 and 1000000000;
 if median is not null then return median; end if;
 select pack_json#>'{crm,typicalBasket}' into basket from chat_knowledge_packs
  where tenant_id=t and brand_id=brand and status='published' order by version desc limit 1;
 if basket->>'currency'=currency_code and jsonb_typeof(basket->'amount')='number'
  and (basket->>'amount')::numeric between 0 and 1000000000 then return round((basket->>'amount')::numeric,2); end if;
 return null;
end $$;
revoke all on function chat_lead_value(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;

-- Keep the proven transport capture as an internal part of the SAME database transaction.
alter function chat_capture(jsonb,text,jsonb) rename to chat_capture_memory;
revoke all on function chat_capture_memory(jsonb,text,jsonb) from public,anon,authenticated,service_role;
create function public.chat_enrich_capture(p_context jsonb,p_input jsonb,result jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; cv chat_conversations%rowtype; ch chat_channels%rowtype;
 msg chat_messages%rowtype; person uuid; lead_id uuid; key_value text; ref text; alphabet text:='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
 reply_at timestamptz; human_at timestamptz; latest_reply timestamptz; earliest timestamptz; latest timestamptz; mapped uuid;
 phone_key text; extra_kind text; extra_value text; candidate uuid; matched_customer uuid; refs text[];
 identity jsonb:=coalesce(p_input->'identity','{}'); n integer; attempt integer;
begin
 if result->>'messageId' is null then return result; end if;
 insert into chat_lead_capture_receipts(tenant_id,message_id) values(t,(result->>'messageId')::uuid) on conflict do nothing;
 if not found then return result; end if;
 select * into cv from chat_conversations where tenant_id=t and id=(result->>'conversationId')::uuid;
 select * into ch from chat_channels where tenant_id=t and id=cv.channel_id;
 select * into msg from chat_messages where tenant_id=t and id=(result->>'messageId')::uuid;
 key_value:=(p_input->>'workspaceId')||':'||cv.chatwoot_contact_id::text;
 select contact_id into person from chat_contact_identities where tenant_id=t and kind='chatwoot_contact' and value=key_value;
 -- Only server-validated WhatsApp source/phone agreement is a possession identity.
 phone_key:=identity->>'phoneE164';
 if phone_key is not null and (ch.kind<>'whatsapp' or phone_key !~ '^\+[1-9][0-9]{6,14}$'
 or replace(identity->>'sourceId','+','') is distinct from substr(phone_key,2)) then raise exception 'Invalid phone identity'; end if;
 if ch.kind in ('website','instagram','facebook') and nullif(identity->>'sourceId','') is not null then
  extra_kind:=case ch.kind when 'website' then 'web_visitor' else ch.kind end;
  extra_value:=ch.id::text||':'||(identity->>'sourceId');
 elsif phone_key is not null then extra_kind:='phone'; extra_value:=phone_key;
 end if;
 if extra_kind is not null then
  select contact_id into candidate from chat_contact_identities where tenant_id=t and kind=extra_kind and value=extra_value;
 end if;
 if person is null then person:=candidate; end if;
 if person is null then
  insert into chat_contacts(tenant_id,display_name,first_seen_at,last_seen_at)
  values(t,nullif(btrim(identity->>'displayName'),''),msg.created_at,msg.created_at) returning id into person;
 end if;
 insert into chat_contact_identities(tenant_id,contact_id,kind,value,verified)
 values(t,person,'chatwoot_contact',key_value,true) on conflict(tenant_id,kind,value) do nothing;
 if candidate is not null and candidate<>person then
  insert into chat_identity_conflicts(tenant_id,contact_id,candidate_contact_id,kind,value)
  values(t,person,candidate,extra_kind,extra_value) on conflict do nothing;
 elsif extra_kind is not null then
  insert into chat_contact_identities(tenant_id,contact_id,kind,value,verified)
  values(t,person,extra_kind,extra_value,true) on conflict(tenant_id,kind,value) do nothing;
 end if;
 -- Profiles never overwrite identity or link a customer by an unverified phone/email.
 update chat_contacts set first_seen_at=least(first_seen_at,msg.created_at),last_seen_at=greatest(last_seen_at,msg.created_at),
  version=version+1 where tenant_id=t and id=person;
 update chat_conversations set contact_id=person where tenant_id=t and id=cv.id;
 if phone_key is not null and exists(select 1 from chat_contact_identities where tenant_id=t and contact_id=person and kind='phone' and value=phone_key and verified) then
  select id into matched_customer from customers where tenant_id=t and normalized_phone_e164=phone_key and deleted_at is null for share;
  if matched_customer is not null and exists(select 1 from chat_contacts where tenant_id=t and id=person and customer_id is null) then
   update chat_contacts set customer_id=matched_customer,version=version+1 where tenant_id=t and id=person;
   update leads set customer_id=matched_customer,version=version+1 where tenant_id=t and contact_id=person;
   for lead_id in select id from leads where tenant_id=t and contact_id=person loop
    perform chat_lead_event(p_context,lead_id,'linked_customer',jsonb_build_object('customerId',matched_customer,'reason','exact_whatsapp_phone'));
   end loop;
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.contact.linked','chat_contact',person,'WEBHOOK','chatwoot','WEBHOOK',p_context->>'correlationId',jsonb_build_object('customerId',matched_customer));
  end if;
 end if;
 if ch.kind='whatsapp' and msg.author='customer' and not msg.private then
  select array_agg(distinct upper(m[2])) into refs from regexp_matches(coalesce(msg.content,''),'(^|[[:space:]])REF:([2-9A-HJKMNP-Z]{5})($|[[:space:].,!?])','gi') m;
  if cardinality(refs)=1 then
   select contact_id into candidate from leads where tenant_id=t and ref_code=refs[1] and channel_kind in ('instagram','facebook');
   if candidate is not null and candidate<>person then
    insert into chat_identity_conflicts(tenant_id,contact_id,candidate_contact_id,kind,value)
     values(t,person,candidate,'lead_ref',refs[1]) on conflict do nothing;
   end if;
  end if;
 end if;
 select id into lead_id from leads where tenant_id=t and conversation_id=cv.id and closed_at is null;
 if lead_id is null and msg.author='customer' and not msg.private
 and not exists(select 1 from leads where tenant_id=t and conversation_id=cv.id and closed_at>=msg.created_at) then
  -- 30^5 short references. Retry boundedly; a ref is a convenience, never authentication.
  for attempt in 1..32 loop
   ref:='';
   for n in 1..5 loop ref:=ref||substr(alphabet,1+(get_byte(gen_random_bytes(1),0)%length(alphabet)),1); end loop;
   begin
    insert into leads(tenant_id,ref_code,brand_id,location_id,channel_id,channel_kind,contact_id,conversation_id,customer_id,currency,first_customer_at,last_customer_at)
    select t,ref,ch.brand_id,ch.default_location_id,ch.id,ch.kind,person,cv.id,cc.customer_id,coalesce((select default_currency from chat_settings where tenant_id=t),'INR'),msg.created_at,msg.created_at
    from chat_contacts cc where cc.tenant_id=t and cc.id=person returning id into lead_id;
    exit;
   exception when unique_violation then
    if attempt=32 then raise exception 'Lead reference unavailable'; end if;
   end;
  end loop;
  perform chat_lead_event(p_context,lead_id,'created',jsonb_build_object('messageId',msg.id));
 end if;
 if lead_id is not null then
  -- Derive clocks from stored public facts, independent of callback arrival order.
  select min(created_at),max(created_at) into earliest,latest from chat_messages
   where tenant_id=t and conversation_id=cv.id and author='customer' and not private
   and created_at>coalesce((select max(closed_at) from leads where tenant_id=t and conversation_id=cv.id and id<>lead_id),'-infinity'::timestamptz);
  select min(created_at),min(created_at) filter(where author='staff'),max(created_at) into reply_at,human_at,latest_reply
   from chat_messages where tenant_id=t and conversation_id=cv.id and not private and author in ('staff','bot') and created_at>=earliest;
  select sl.tenant_user_id into mapped from chat_messages m
   join chat_staff_links sl on sl.tenant_id=m.tenant_id and sl.chatwoot_user_id=m.staff_chatwoot_user_id
   join tenant_users u on u.tenant_id=sl.tenant_id and u.id=sl.tenant_user_id and u.status='active' and u.role in ('owner_admin','manager')
   where m.tenant_id=t and m.conversation_id=cv.id and m.author='staff' and not m.private and m.created_at>=earliest
   order by m.created_at,m.chatwoot_message_id limit 1;
  if mapped is not null and exists(select 1 from leads where tenant_id=t and id=lead_id and owner_source is distinct from 'manual' and owner_tenant_user_id is distinct from mapped) then
   update leads set owner_tenant_user_id=mapped,owner_source='auto' where tenant_id=t and id=lead_id;
   perform chat_lead_event(p_context,lead_id,'assigned',jsonb_build_object('ownerId',mapped,'reason','first_public_staff_reply'));
  end if;
  if reply_at is not null and exists(select 1 from leads where tenant_id=t and id=lead_id and stage='new') then
   update leads set stage='engaged' where tenant_id=t and id=lead_id;
   perform chat_lead_event(p_context,lead_id,'stage',jsonb_build_object('from','new','to','engaged','reason','public_reply'));
  end if;
  update leads set first_customer_at=earliest,last_customer_at=latest,first_response_at=reply_at,
   first_human_response_at=human_at,last_reply_at=latest_reply,est_value=chat_lead_value(t,customer_id,brand_id,kind,currency),version=version+1
   where tenant_id=t and id=lead_id;
  if not msg.private and msg.author in ('staff','bot') then
   perform chat_lead_event(p_context,lead_id,'reply',jsonb_build_object('messageId',msg.id,'human',msg.author='staff'));
  end if;
 end if;
 return result;
end $$;
revoke all on function chat_enrich_capture(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.chat_capture(p_context jsonb,p_kind text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=chat_capture_memory(p_context,p_kind,p_input);
 if coalesce((result->>'inserted')::boolean,false) then return chat_enrich_capture(p_context,p_input,result); end if;
 return result;
end $$;
revoke all on function chat_capture(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_capture(jsonb,text,jsonb) to service_role;
commit;


