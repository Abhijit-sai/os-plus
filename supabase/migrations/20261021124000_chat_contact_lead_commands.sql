begin;
-- Keep every existing platform task kind and add only the two authorised Chat subjects/kinds.
alter table tasks drop constraint tasks_task_type_check, drop constraint tasks_subject_type_check;
alter table tasks add constraint tasks_task_type_check check(task_type in
 ('PICKUP','VERIFY_INTAKE','RECEIVE_MANIFEST','INVESTIGATE_VARIANCE','PROCESS_WORK_UNIT','DELIVERY','COLLECT_PAYMENT','RECONCILE_PAYMENT','GENERAL','CHAT_HANDOFF','LEAD_FOLLOW_UP')),
 add constraint tasks_subject_type_check check(subject_type in
 ('pickup_request','handling_unit','manifest','work_unit','order','invoice','payment','delivery','collection_batch','general','lead','chat_conversation'));

create table public.chat_contact_merges (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 from_contact_id uuid not null, to_contact_id uuid not null, snapshot_json jsonb not null, after_hash text not null,
 created_at timestamptz not null default now(), created_by text not null, split_at timestamptz, split_by text,
 unique(tenant_id,id),
 foreign key(tenant_id,from_contact_id) references chat_contacts(tenant_id,id),
 foreign key(tenant_id,to_contact_id) references chat_contacts(tenant_id,id), check(from_contact_id<>to_contact_id)
);
alter table chat_contact_merges enable row level security;
revoke all on chat_contact_merges from public,anon,authenticated,service_role;
grant select on chat_contact_merges to service_role;
-- Conservative undo fingerprint: new traffic or any edits require fresh manual reconciliation.
create function public.chat_contact_merge_hash(t uuid,a uuid,b uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select encode(digest(jsonb_build_object(
 'contacts',(select jsonb_agg(to_jsonb(c) order by id) from chat_contacts c where tenant_id=t and id in (a,b)),
 'identities',(select jsonb_agg(to_jsonb(i) order by id) from chat_contact_identities i where tenant_id=t and contact_id in (a,b)),
 'conversations',(select jsonb_agg(to_jsonb(v) order by id) from chat_conversations v where tenant_id=t and contact_id in (a,b)),
 'leads',(select jsonb_agg(to_jsonb(l) order by id) from leads l where tenant_id=t and contact_id in (a,b))
 )::text,'sha256'),'hex');
$$;
revoke all on function chat_contact_merge_hash(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.chat_lead_authorize(ctx jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(ctx->>'tenantId')::uuid;
begin
 if ctx#>>'{actor,type}' is distinct from 'USER' or ctx->>'source' is distinct from 'OS_PLUS_UI'
 or nullif(btrim(ctx->>'correlationId'),'') is null then raise exception 'Invalid lead command context'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 perform 1 from tenants where id=t and status='active' for share;
 if not found then raise exception 'Lead access denied'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled for share;
 if not found then raise exception 'Lead access denied'; end if;
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=ctx#>>'{actor,id}' and status='active' and role in ('owner_admin','manager') for share;
 if not found then raise exception 'Lead access denied'; end if;
 return t;
end $$;
revoke all on function chat_lead_authorize(jsonb) from public,anon,authenticated,service_role;

create function public.chat_lead_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid; key text:=p_context->>'idempotencyKey'; request_hash text; receipt command_idempotency%rowtype;
 person chat_contacts%rowtype; target customers%rowtype; customer uuid; l uuid; result jsonb; event_kind text; old_lead leads%rowtype; new_lead leads%rowtype; other_person chat_contacts%rowtype; merge_row chat_contact_merges%rowtype; snapshot jsonb; merge_id uuid; priorities jsonb; chosen_intent text;
begin
 t:=chat_lead_authorize(p_context);
 if key is null or length(key) not between 1 and 160 or p_action not in ('contact.convert','contact.link','lead.edit','contact.merge','contact.split','lead.record') then raise exception 'Invalid lead command'; end if;
 request_hash:=encode(digest(p_action||p_input::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_LEAD' and idempotency_key=key for update;
 if found then
  if receipt.request_hash<>request_hash or receipt.status<>'completed' then raise exception 'Lead command conflict'; end if;
  return receipt.result_json;
 end if;
 if p_action='contact.merge' then
  select * into person from chat_contacts where tenant_id=t and id=(p_input->>'fromId')::uuid and merged_into is null and deleted_at is null for update;
  select * into other_person from chat_contacts where tenant_id=t and id=(p_input->>'toId')::uuid and merged_into is null and deleted_at is null for update;
  if person.id is null or other_person.id is null or person.id=other_person.id
   or person.version is distinct from (p_input->>'fromVersion')::integer or other_person.version is distinct from (p_input->>'toVersion')::integer
   then raise exception 'Contacts changed; reload'; end if;
  if person.customer_id is distinct from other_person.customer_id then raise exception 'Resolve customer links before merging'; end if;
  snapshot:=jsonb_build_object(
   'identities',coalesce((select jsonb_agg(id) from chat_contact_identities where tenant_id=t and contact_id=person.id),'[]'),
   'conversations',coalesce((select jsonb_agg(id) from chat_conversations where tenant_id=t and contact_id=person.id),'[]'),
   'leads',coalesce((select jsonb_agg(id) from leads where tenant_id=t and contact_id=person.id),'[]'));
  update chat_contact_identities set contact_id=other_person.id where tenant_id=t and contact_id=person.id;
  update chat_conversations set contact_id=other_person.id where tenant_id=t and contact_id=person.id;
  update leads set contact_id=other_person.id,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and contact_id=person.id;
  update chat_contacts set merged_into=other_person.id,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=person.id;
  update chat_contacts set version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=other_person.id;
  insert into chat_contact_merges(tenant_id,from_contact_id,to_contact_id,snapshot_json,after_hash,created_by)
   values(t,person.id,other_person.id,snapshot,chat_contact_merge_hash(t,person.id,other_person.id),p_context#>>'{actor,id}') returning id into merge_id;
  for l in select id from leads where tenant_id=t and contact_id=other_person.id loop
   perform chat_lead_event(p_context,l,'merged',jsonb_build_object('mergeId',merge_id,'from',person.id,'to',other_person.id));
  end loop;
  result:=jsonb_build_object('mergeId',merge_id,'contactId',other_person.id);
 elsif p_action='contact.split' then
  select * into merge_row from chat_contact_merges where tenant_id=t and id=(p_input->>'mergeId')::uuid and split_at is null for update;
  if not found or merge_row.after_hash is distinct from chat_contact_merge_hash(t,merge_row.from_contact_id,merge_row.to_contact_id)
   then raise exception 'Merge changed; manual reconciliation required'; end if;
  update chat_contact_identities set contact_id=merge_row.from_contact_id where tenant_id=t and id in (select value::uuid from jsonb_array_elements_text(merge_row.snapshot_json->'identities'));
  update chat_conversations set contact_id=merge_row.from_contact_id where tenant_id=t and id in (select value::uuid from jsonb_array_elements_text(merge_row.snapshot_json->'conversations'));
  update leads set contact_id=merge_row.from_contact_id,version=version+1,updated_by=p_context#>>'{actor,id}'
   where tenant_id=t and id in (select value::uuid from jsonb_array_elements_text(merge_row.snapshot_json->'leads'));
  update chat_contacts set merged_into=null,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=merge_row.from_contact_id;
  update chat_contacts set version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=merge_row.to_contact_id;
  update chat_contact_merges set split_at=now(),split_by=p_context#>>'{actor,id}' where tenant_id=t and id=merge_row.id;
  for l in select id from leads where tenant_id=t and contact_id in (merge_row.from_contact_id,merge_row.to_contact_id) loop
   perform chat_lead_event(p_context,l,'split',jsonb_build_object('mergeId',merge_row.id));
  end loop;
  result:=jsonb_build_object('mergeId',merge_row.id,'contactId',merge_row.from_contact_id);
 elsif p_action='lead.record' then
  select * into old_lead from leads where tenant_id=t and id=(p_input->>'leadId')::uuid for update;
  if not found or old_lead.version is distinct from (p_input->>'version')::integer or old_lead.customer_id is null then raise exception 'Lead changed or customer unlinked'; end if;
  if p_input ? 'orderId' and p_input->>'orderId' is not null then
   perform 1 from orders where tenant_id=t and id=(p_input->>'orderId')::uuid and customer_id=old_lead.customer_id and deleted_at is null and order_status not in ('draft','cancelled') for share;
   if not found then raise exception 'Real linked customer order required'; end if;
  end if;
  if p_input->>'bookingType'='laundry_pickup_request' then
   perform 1 from laundry_pickup_requests where tenant_id=t and id=(p_input->>'bookingId')::uuid and customer_id=old_lead.customer_id and deleted_at is null for share;
   if not found then raise exception 'Booking unavailable'; end if;
  elsif p_input->>'bookingType'='task' then
   perform 1 from tasks where tenant_id=t and id=(p_input->>'bookingId')::uuid and deleted_at is null and task_type='LEAD_FOLLOW_UP'
    and ((subject_type='lead' and subject_id=old_lead.id) or (subject_type='chat_conversation' and subject_id=old_lead.conversation_id)) for share;
   if not found then raise exception 'Booking unavailable'; end if;
  elsif p_input->>'bookingType' is not null then raise exception 'Invalid booking type';
  end if;
  if (p_input->>'bookingType' is null)<>(p_input->>'bookingId' is null) then raise exception 'Invalid booking link'; end if;
  update leads set order_id=case when p_input ? 'orderId' then (p_input->>'orderId')::uuid else order_id end,
   booking_subject_type=case when p_input ? 'bookingType' then p_input->>'bookingType' else booking_subject_type end,
   booking_pickup_id=case when p_input ? 'bookingType' then case when p_input->>'bookingType'='laundry_pickup_request' then (p_input->>'bookingId')::uuid else null end else booking_pickup_id end,
   booking_task_id=case when p_input ? 'bookingType' then case when p_input->>'bookingType'='task' then (p_input->>'bookingId')::uuid else null end else booking_task_id end,
   booking_subject_id=case when p_input ? 'bookingId' then (p_input->>'bookingId')::uuid else booking_subject_id end,
   version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=old_lead.id returning * into new_lead;
  perform chat_lead_event(p_context,new_lead.id,'record_linked',jsonb_build_object('orderId',new_lead.order_id,'bookingType',new_lead.booking_subject_type,'bookingId',new_lead.booking_subject_id));
  result:=jsonb_build_object('id',new_lead.id,'version',new_lead.version);
 elsif p_action='lead.edit' then
  select * into old_lead from leads where tenant_id=t and id=(p_input->>'leadId')::uuid for update;
  if not found or old_lead.version is distinct from (p_input->>'version')::integer then raise exception 'Lead changed; reload'; end if;
  if p_input ? 'ownerId' and p_input->>'ownerId' is not null then
   perform 1 from tenant_users where tenant_id=t and id=(p_input->>'ownerId')::uuid and status='active' and role in ('owner_admin','manager') for share;
   if not found then raise exception 'Owner unavailable'; end if;
  end if;
  if p_input ? 'stage' and (p_input->>'stage' is null or p_input->>'stage' not in ('new','engaged','booked','in_progress','won','lost')) then raise exception 'Invalid stage'; end if;
  if p_input->>'stage'='lost' and nullif(btrim(p_input->>'lostReason'),'') is null then raise exception 'Lost reason required'; end if;
  chosen_intent:=old_lead.intent;
  if p_input ? 'intent' then
   if p_input->>'intent' is null or p_input->>'intent' !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'Invalid intent'; end if;
   select pack_json#>'{crm,intentPriorities}' into priorities from chat_knowledge_packs
    where tenant_id=t and brand_id=old_lead.brand_id and status='published' order by version desc limit 1;
   priorities:=coalesce(priorities,'{}'::jsonb);
   if not priorities ? (p_input->>'intent') then raise exception 'Intent is not configured'; end if;
   if old_lead.intent is null or (priorities ? old_lead.intent and (priorities->>(p_input->>'intent'))::integer>(priorities->>old_lead.intent)::integer)
    then chosen_intent:=p_input->>'intent'; end if;
  end if;
  update leads set
   intent=chosen_intent,
   stage=case when p_input ? 'stage' then p_input->>'stage' else stage end,
   closed_at=case when p_input ? 'stage' then case when p_input->>'stage' in ('won','lost') then coalesce(closed_at,now()) else null end else closed_at end,
   lost_reason=case when p_input ? 'stage' then case when p_input->>'stage'='lost' then p_input->>'lostReason' else null end else lost_reason end,
   owner_source=case when p_input ? 'ownerId' then 'manual' else owner_source end,
   owner_tenant_user_id=case when p_input ? 'ownerId' then (p_input->>'ownerId')::uuid else owner_tenant_user_id end,
   notes=case when p_input ? 'notes' then p_input->>'notes' else notes end,
   kind=case when p_input ? 'kind' then p_input->>'kind' else kind end,
   est_value=case when coalesce(p_input->>'kind',kind)<>'sales' then null else est_value end,
   version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=old_lead.id returning * into new_lead;
  if old_lead.intent is distinct from new_lead.intent then
   perform chat_lead_event(p_context,new_lead.id,'intent',jsonb_build_object('from',old_lead.intent,'to',new_lead.intent));
  end if;
  if old_lead.stage<>new_lead.stage then
   perform chat_lead_event(p_context,new_lead.id,'stage',jsonb_build_object('from',old_lead.stage,'to',new_lead.stage,'reason',new_lead.lost_reason));
  end if;
  if old_lead.owner_tenant_user_id is distinct from new_lead.owner_tenant_user_id then
   perform chat_lead_event(p_context,new_lead.id,'assigned',jsonb_build_object('from',old_lead.owner_tenant_user_id,'to',new_lead.owner_tenant_user_id));
  end if;
  if p_input ? 'notes' or p_input ? 'kind' then
   perform chat_lead_event(p_context,new_lead.id,'note',jsonb_build_object('notes',new_lead.notes,'kind',new_lead.kind));
  end if;
  result:=jsonb_build_object('id',new_lead.id,'version',new_lead.version);
 else
 select * into person from chat_contacts where tenant_id=t and id=(p_input->>'contactId')::uuid and merged_into is null and deleted_at is null for update;
 if not found then raise exception 'Contact unavailable'; end if;
 if p_action='contact.link' then
  select c.* into target from customers c join chat_contact_identities i on i.tenant_id=c.tenant_id and i.contact_id=person.id and i.kind='phone' and i.verified and i.value=c.normalized_phone_e164
   where c.tenant_id=t and c.id=(p_input->>'customerId')::uuid and c.deleted_at is null for share of c;
  if not found then raise exception 'Exact customer identity required'; end if;
  customer:=target.id; event_kind:='linked_customer';
 else
  if length(btrim(p_input->>'name')) not between 2 and 200 or nullif(btrim(p_input->>'name'),'') is null
   or (p_input->>'phoneE164' is not null and p_input->>'phoneE164' !~ '^\+[1-9][0-9]{7,14}$')
   then raise exception 'Invalid customer details'; end if;
  if person.customer_id is not null then customer:=person.customer_id;
  elsif p_input->>'phoneE164' is not null then
   select id into customer from customers where tenant_id=t and normalized_phone_e164=p_input->>'phoneE164' and deleted_at is null for share;
  end if;
  if customer is null then
   -- Unique canonical-phone index also protects races with the existing platform customer action.
   insert into customers(tenant_id,name,phone,normalized_phone_e164,email,created_by,updated_by)
   values(t,btrim(p_input->>'name'),p_input->>'phone',p_input->>'phoneE164',p_input->>'email',p_context#>>'{actor,id}',p_context#>>'{actor,id}')
   on conflict(tenant_id,normalized_phone_e164) where deleted_at is null and normalized_phone_e164 is not null do nothing returning id into customer;
   if customer is null then
    select id into customer from customers where tenant_id=t and normalized_phone_e164=p_input->>'phoneE164' and deleted_at is null for share;
   end if;
  end if;
  event_kind:='converted';
 end if;
 perform 1 from customers where tenant_id=t and id=customer and deleted_at is null for share;
 if not found or (person.customer_id is not null and person.customer_id<>customer) then raise exception 'Customer link conflict'; end if;
 update chat_contacts set customer_id=customer,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=person.id;
 update leads set customer_id=customer,est_value=chat_lead_value(t,customer,brand_id,kind,currency),version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and contact_id=person.id;
 for l in select id from leads where tenant_id=t and contact_id=person.id loop
  perform chat_lead_event(p_context,l,event_kind,jsonb_build_object('customerId',customer,'contactId',person.id));
 end loop;
 -- Contacts may exist before any inquiry/lead.
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.contact.'||event_kind,'chat_contact',person.id,'USER',p_context#>>'{actor,id}',p_context->>'source',p_context->>'correlationId',jsonb_build_object('customerId',customer));
 result:=jsonb_build_object('contactId',person.id,'customerId',customer);
 end if;
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.command.executed',case when p_action like 'lead.%' then 'lead' else 'chat_contact' end,
 coalesce((result->>'id')::uuid,(result->>'contactId')::uuid),'USER',p_context#>>'{actor,id}',p_context->>'source',p_context->>'correlationId',
 jsonb_build_object('action',p_action,'result',result));
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_LEAD',key,request_hash,'completed',result,now());
 return result;
end $$;
revoke all on function chat_lead_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_lead_command(jsonb,text,jsonb) to service_role;
commit;
