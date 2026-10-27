begin;
create function public.chat_request_workflow(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid;key text:=p_context->>'idempotencyKey';h text;receipt command_idempotency%rowtype;
 r chat_action_requests%rowtype;c chat_channels%rowtype;p chat_knowledge_packs%rowtype;l leads%rowtype;
 msg chat_messages%rowtype;summary chat_messages%rowtype;person chat_contacts%rowtype;
 result jsonb;config jsonb;review text;services text;phone text;customer uuid;address_id uuid;created jsonb;
 staff uuid;task uuid;rec chat_task_records%rowtype;field text;requested date;
begin
 t:=chat_lead_authorize(p_context);
 if key is null or length(key) not between 1 and 160 or p_action is null or p_action not in ('review','confirm','approve','change')
  or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid request workflow'; end if;
 h:=encode(digest(p_action||p_input::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_REQUEST_WORKFLOW' and idempotency_key=key for update;
 if found then
  if receipt.request_hash<>h or receipt.status<>'completed' then raise exception 'Request workflow conflict'; end if;
  return receipt.result_json;
 end if;
 select * into r from chat_action_requests where tenant_id=t and id=(p_input->>'id')::uuid for update;
 if not found or r.version is distinct from (p_input->>'version')::integer then raise exception 'Request changed; reload'; end if;
 if r.status='withdrawn' then raise exception 'Request was withdrawn'; end if;
 select * into l from leads where tenant_id=t and id=r.lead_id for update;
 if p_action='change' and r.status='materialized' then
  created:=chat_handoff_upsert(p_context,l.id,(p_input->>'messageId')::uuid,'operational_change',null);
  perform chat_lead_event(p_context,l.id,'request.change_handoff',jsonb_build_object('requestId',r.id,'taskId',created->>'taskId'));
  result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'taskId',created->>'taskId','pickupId',r.pickup_id,'reviewText',null);
 else
  if r.status='materialized' then raise exception 'Operational request already materialized'; end if;
  if l.closed_at is not null then raise exception 'Enquiry closed'; end if;
  select * into c from chat_channels where tenant_id=t and id=r.channel_id and brand_id=r.brand_id and is_active and can_book for share;
  if not found then raise exception 'Booking channel unavailable'; end if;
  perform 1 from chat_workspaces where tenant_id=t and id=c.workspace_id and status='active' for share;
  if not found then raise exception 'Chat connection unavailable'; end if;
  perform 1 from chat_brands where tenant_id=t and id=r.brand_id and is_active and deleted_at is null for share;
  if not found then raise exception 'Business unavailable'; end if;
  select * into p from chat_knowledge_packs where tenant_id=t and brand_id=r.brand_id and status='published' order by version desc limit 1 for share;
  if not found or p.pack_json#>>'{booking,capability}' is distinct from r.capability then raise exception 'Current booking configuration unavailable'; end if;
  select * into person from chat_contacts where tenant_id=t and id=r.contact_id and merged_into is null and deleted_at is null for update;
  if not found or l.contact_id<>r.contact_id or l.conversation_id<>r.conversation_id then raise exception 'Contact changed'; end if;
  if r.capability='laundry_pickup' then perform assert_laundry_vertical_enabled(t); end if;
  if jsonb_array_length(r.details_json->'services')=0 or exists(select 1 from jsonb_array_elements_text(r.details_json->'services') s
   where not exists(select 1 from jsonb_array_elements(p.pack_json->'services') svc where svc->>'key'=s)) then raise exception 'Choose configured services'; end if;
  select string_agg(svc->>'name',', ' order by svc->>'key') into services from jsonb_array_elements(p.pack_json->'services') svc
   where svc->>'key' in (select jsonb_array_elements_text(r.details_json->'services'));
  if p_action='review' then
   config:=p.pack_json#>'{booking,confirmation}';
   if config is null or nullif(btrim(config->>'intro'),'') is null or jsonb_typeof(config->'phrases') is distinct from 'array' or jsonb_array_length(config->'phrases')=0
    then raise exception 'Configure reviewed confirmation wording first'; end if;
   select string_agg(svc->>'name',', ' order by svc->>'key') into services from jsonb_array_elements(p.pack_json->'services') svc
    where svc->>'key' in (select jsonb_array_elements_text(r.details_json->'services'));
   review:=config->>'intro';
   if nullif(btrim(config#>>'{labels,services}'),'') is null then raise exception 'Configure summary labels'; end if;
   review:=review||chr(10)||(config#>>'{labels,services}')||': '||services;
   foreach field in array array['name','address','date','window','timePreference'] loop
    if nullif(r.details_json->>field,'') is not null then
     if nullif(btrim(config#>>array['labels',field]),'') is null then raise exception 'Configure summary labels'; end if;
     review:=review||chr(10)||(config#>>array['labels',field])||': '||case when field='window' then
      coalesce((select v->>'label' from jsonb_array_elements(coalesce(p.pack_json#>'{booking,windows}','[]')) v where v->>'key'=r.details_json->>'window'),r.details_json->>'window') else r.details_json->>field end;
    end if;
   end loop;
   if length(review)>6000 or review~'\{\{|\}\}|\$\{' then raise exception 'Invalid summary text'; end if;
   update chat_action_requests set review_text=review,review_pack_id=p.id,review_revision=revision,review_prepared_at=clock_timestamp(),
    status='requested',confirmed_revision=null,confirmation_message_id=null,summary_message_id=null,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
  elsif p_action='confirm' then
   if r.review_text is null or r.review_pack_id is distinct from p.id or r.review_revision is distinct from r.revision then raise exception 'Current summary required'; end if;
   select * into msg from chat_messages where tenant_id=t and conversation_id=r.conversation_id and id=(p_input->>'messageId')::uuid and author='customer' and not private;
   if not found then raise exception 'Customer confirmation unavailable'; end if;
   select * into summary from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author in ('staff','bot') and not private
    and content=r.review_text and created_at>=r.review_prepared_at and (created_at,chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id) order by created_at desc,chatwoot_message_id desc limit 1;
   if not found then raise exception 'Current public summary required before confirmation'; end if;
   if not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(msg.content)))
    or exists(select 1 from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private and (created_at,chatwoot_message_id)>(msg.created_at,msg.chatwoot_message_id))
    or exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private
     and (m.created_at,m.chatwoot_message_id)>(summary.created_at,summary.chatwoot_message_id)
     and (m.created_at,m.chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id)
     and not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(m.content))))
    then raise exception 'Current exact customer confirmation required'; end if;
   update chat_action_requests set status='customer_confirmed',confirmed_revision=revision,confirmation_message_id=msg.id,summary_message_id=summary.id,
    version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
  elsif p_action='approve' then
   if r.status<>'customer_confirmed' or r.confirmed_revision is distinct from r.revision or r.review_pack_id is distinct from p.id or r.review_revision is distinct from r.revision
    then raise exception 'Current complete request confirmation required'; end if;
   select * into msg from chat_messages where tenant_id=t and conversation_id=r.conversation_id and id=r.confirmation_message_id and author='customer' and not private;
   if not found or exists(select 1 from chat_messages where tenant_id=t and conversation_id=r.conversation_id and author='customer' and not private and (created_at,chatwoot_message_id)>(msg.created_at,msg.chatwoot_message_id))
    then raise exception 'Customer confirmation changed'; end if;
   -- Recheck the entire interval: delayed captures must not resurrect an obsolete summary.
   select * into summary from chat_messages where tenant_id=t and id=r.summary_message_id and conversation_id=r.conversation_id
    and author in ('staff','bot') and not private and content=r.review_text and created_at>=r.review_prepared_at
    and (created_at,chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id);
   if not found or exists(select 1 from chat_messages m where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private
    and (m.created_at,m.chatwoot_message_id)>(summary.created_at,summary.chatwoot_message_id)
    and (m.created_at,m.chatwoot_message_id)<(msg.created_at,msg.chatwoot_message_id)
    and not exists(select 1 from jsonb_array_elements_text(p.pack_json#>'{booking,confirmation,phrases}') phrase where lower(btrim(phrase))=lower(btrim(m.content))))
    then raise exception 'Customer confirmation changed'; end if;
   select case when count(*)=1 then min(value) else null end into phone from chat_contact_identities where tenant_id=t and contact_id=person.id and kind='phone' and verified;
   if c.kind<>'whatsapp' or phone is null then raise exception 'Verified WhatsApp identity required'; end if;
   select id into staff from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and status='active' and role in ('owner_admin','manager') for share;
   if r.capability='follow_up_task' then
    update chat_task_records record set closed_at=now() from tasks taskrow where record.tenant_id=t and record.lead_id=l.id and record.task_id=taskrow.id and taskrow.tenant_id=t
     and record.closed_at is null and taskrow.status in ('COMPLETED','CANCELLED');
    select * into rec from chat_task_records where tenant_id=t and lead_id=l.id and work_kind='LEAD_FOLLOW_UP' and closed_at is null for update;
    if found then task:=rec.task_id;
    else
     created:=create_task_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId','chat-request:'||r.id::text,'LEAD_FOLLOW_UP',
      'Follow up customer request','Review the confirmed request in the linked enquiry. This task does not reserve an appointment.','lead',l.id);
     task:=(created->>'task_id')::uuid;
     insert into chat_task_records(tenant_id,lead_id,task_id,work_kind,route_source) values(t,l.id,task,'LEAD_FOLLOW_UP','unassigned');
    end if;
    update leads set booking_subject_type='task',booking_subject_id=task,booking_task_id=task,version=version+1,updated_by=p_context#>>'{actor,id}'
     where tenant_id=t and id=l.id and booking_subject_type is null;
    update chat_action_requests set status='materialized',task_id=task,approved_by=staff,approved_at=now(),version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
   else
    if length(btrim(coalesce(r.details_json->>'name',''))) not between 2 and 200 or nullif(btrim(r.details_json->>'address'),'') is null
     or r.details_json->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or nullif(r.details_json->>'date','') is null
     or not exists(select 1 from jsonb_array_elements(coalesce(p.pack_json#>'{booking,windows}','[]')) w where w->>'key'=r.details_json->>'window')
     then raise exception 'Complete Laundry details required'; end if;
    requested:=(r.details_json->>'date')::date;
    if requested<(select (now() at time zone timezone)::date from chat_settings where tenant_id=t) then raise exception 'Choose a current pickup date'; end if;
    if person.customer_id is not null then
     select id into customer from customers where tenant_id=t and id=person.customer_id and deleted_at is null and normalized_phone_e164=phone for share;
     if not found then raise exception 'Resolve exact customer identity before approval'; end if;
    else
     created:=chat_lead_command(p_context||jsonb_build_object('idempotencyKey','chat-customer:'||r.id::text),'contact.convert',
      jsonb_build_object('contactId',person.id,'name',r.details_json->>'name','phone',phone,'phoneE164',phone));
     customer:=(created->>'customerId')::uuid;
    end if;
    -- No saved address is overwritten. Structured address parts remain unknown unless staff supplied them.
    if p_input->>'countryCode' is null or p_input->>'countryCode' !~ '^[A-Z]{2}$' then raise exception 'Staff must confirm the address country'; end if;
    select id into address_id from customer_addresses where tenant_id=t and customer_id=customer and deleted_at is null
     and lower(btrim(address_line_1))=lower(btrim(r.details_json->>'address')) and country_code=p_input->>'countryCode'
     and nullif(btrim(coalesce(address_line_2,'')),'') is null and nullif(btrim(coalesce(area,'')),'') is null
     and nullif(btrim(coalesce(city,'')),'') is null and nullif(btrim(coalesce(state,'')),'') is null
     and nullif(btrim(coalesce(postal_code,'')),'') is null and nullif(btrim(coalesce(landmark,'')),'') is null
     order by created_at,id limit 1 for share;
    if address_id is null then
     insert into customer_addresses(tenant_id,customer_id,label,address_line_1,country_code,source,created_by,updated_by)
      values(t,customer,'Chat pickup',btrim(r.details_json->>'address'),p_input->>'countryCode','whatsapp',p_context#>>'{actor,id}',p_context#>>'{actor,id}') returning id into address_id;
     insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
      values(t,'chat.customer_address.created','customer_address',address_id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('requestId',r.id,'customerId',customer));
    end if;
    created:=create_laundry_pickup_request_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',
     'chat-pickup:'||r.id::text,customer,address_id,requested,r.details_json->>'window','whatsapp',null,null,null,services);
    update leads set customer_id=customer,booking_subject_type='laundry_pickup_request',booking_subject_id=(created->>'pickup_request_id')::uuid,
     booking_pickup_id=(created->>'pickup_request_id')::uuid,booking_task_id=null,version=version+1,updated_by=p_context#>>'{actor,id}'
     where tenant_id=t and id=l.id and booking_subject_type is null;
    if not found then raise exception 'Resolve the existing linked booking before approval'; end if;
    update chat_action_requests set status='materialized',pickup_id=(created->>'pickup_request_id')::uuid,task_id=(created->>'task_id')::uuid,
     customer_id=customer,approved_by=staff,approved_at=now(),version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=r.id returning * into r;
   end if;
  else raise exception 'Operational change requires a materialized request';
  end if;
  perform chat_lead_event(p_context,l.id,'request.'||p_action,jsonb_build_object('requestId',r.id,'revision',r.revision,'taskId',r.task_id,'pickupId',r.pickup_id));
  result:=jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'taskId',r.task_id,'pickupId',r.pickup_id,'reviewText',r.review_text);
 end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_REQUEST_WORKFLOW',key,h,'completed',result,now());
 return result;
end $$;
revoke all on function public.chat_request_workflow(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_request_workflow(jsonb,text,jsonb) to service_role;
commit;
