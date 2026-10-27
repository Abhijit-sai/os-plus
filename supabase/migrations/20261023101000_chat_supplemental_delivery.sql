begin;
create table chat_supplemental_deliveries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 lead_id uuid not null,conversation_id uuid not null,contact_id uuid not null,run_id uuid not null,pack_id uuid not null,order_id uuid,
 kind text not null check(kind in ('price_image','review')),state text not null default 'draft' check(state in ('draft','sending','sent','uncertain')),
 text text not null check(length(text) between 1 and 6000),asset_url text,provider_message_id bigint check(provider_message_id>0),
 created_at timestamptz not null default now(),sent_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,provider_message_id),
 foreign key(tenant_id,lead_id) references leads(tenant_id,id),foreign key(tenant_id,conversation_id) references chat_conversations(tenant_id,id),
 foreign key(tenant_id,contact_id) references chat_contacts(tenant_id,id),foreign key(tenant_id,run_id) references chat_agent_runs(tenant_id,id),
 foreign key(tenant_id,order_id) references orders(tenant_id,id),
 foreign key(tenant_id,pack_id) references chat_knowledge_packs(tenant_id,id),
 check((kind='review')=(order_id is not null)),check((kind='price_image')=(asset_url is not null)),check((state='sent')=(sent_at is not null and provider_message_id is not null))
);
create unique index chat_price_image_once on chat_supplemental_deliveries(tenant_id,conversation_id) where kind='price_image';
create unique index chat_review_per_delivery on chat_supplemental_deliveries(tenant_id,conversation_id,order_id) where kind='review';
alter table chat_supplemental_deliveries enable row level security;
revoke all on chat_supplemental_deliveries from public,anon,authenticated,service_role;
grant select on chat_supplemental_deliveries to service_role;
create function chat_supplemental_valid(p_tenant uuid,p_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare d chat_supplemental_deliveries%rowtype;l leads%rowtype;p chat_knowledge_packs%rowtype;r chat_agent_runs%rowtype;
begin
 select * into d from chat_supplemental_deliveries where tenant_id=p_tenant and id=p_id;
 if not found then return false;end if;
 select * into l from leads where tenant_id=p_tenant and id=d.lead_id and contact_id=d.contact_id and conversation_id=d.conversation_id and first_customer_at<=(select m.created_at from chat_agent_runs run join chat_messages m on m.tenant_id=p_tenant and m.id=run.trigger_message_id where run.tenant_id=p_tenant and run.id=d.run_id)
  and (closed_at is null or closed_at>=(select m.created_at from chat_agent_runs run join chat_messages m on m.tenant_id=p_tenant and m.id=run.trigger_message_id where run.tenant_id=p_tenant and run.id=d.run_id));
 select * into r from chat_agent_runs where tenant_id=p_tenant and id=d.run_id;
 select * into p from chat_knowledge_packs where tenant_id=p_tenant and id=d.pack_id and status='published';
 if l.id is null or p.id is null or r.id is null or not (
  exists(select 1 from chat_public_outbox where tenant_id=p_tenant and run_id=r.id and state='sent')
  or exists(select 1 from chat_draft_sends where tenant_id=p_tenant and run_id=r.id and state='sent' and provider_message_id is not null)) then return false;end if;
 if d.kind='price_image' then
  return p.pack_json->>'priceListImageUrl'=d.asset_url and p.pack_json#>>'{media,priceListCaption}'=d.text
   and exists(select 1 from jsonb_array_elements(coalesce(r.result_json#>'{understanding,signals}','[]')) s
    join chat_messages m on m.tenant_id=p_tenant and m.id=(s->>'messageId')::uuid and m.conversation_id=d.conversation_id and m.author='customer' and not m.private
    where s->>'kind'='price_list' and nullif(s->>'quote','') is not null and strpos(coalesce(m.content,''),s->>'quote')>0);
 end if;
 -- Deliberately no import/paid/production-complete trigger. Shopify requires a future actual-delivery adapter.
 return coalesce((p.pack_json#>>'{review,enabled}')::boolean,false)
  and d.text=(p.pack_json#>>'{review,text}')||chr(10)||(p.pack_json#>>'{review,url}')
  and exists(select 1 from orders where tenant_id=p_tenant and id=l.order_id and id=d.order_id and customer_id=l.customer_id and deleted_at is null
   and order_status='delivered' and source<>'shopify' and updated_at>=l.first_customer_at)
  and not exists(select 1 from chat_supplemental_deliveries other where other.tenant_id=p_tenant and other.contact_id=d.contact_id and other.kind='review' and other.id<>d.id
   and (other.state in ('sending','uncertain') or (other.state='sent' and other.sent_at>now()-make_interval(days=>coalesce((p.pack_json#>>'{review,cooldownDays}')::int,90)))));
end $$;
revoke all on function chat_supplemental_valid(uuid,uuid) from public,anon,authenticated,service_role;
create function chat_supplemental_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;d chat_supplemental_deliveries%rowtype;r chat_agent_runs%rowtype;l leads%rowtype;p chat_knowledge_packs%rowtype;c chat_channels%rowtype;v chat_conversations%rowtype;checked jsonb;delivery_kind text;staff boolean;
begin
 staff:=p_context#>>'{actor,type}'='USER';
 if staff then perform chat_lead_authorize(p_context);
 else checked:=chat_agent_load(p_context,p_input-array['id','kind','providerMessageId','runId','leaseToken']);end if;
 if p_action is null or p_action not in ('prepare','claim','target','record','uncertain') then raise exception 'Invalid supplemental action';end if;
 if p_action='prepare' then
  select * into r from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid;
  if not staff and (r.conversation_id is distinct from (p_input->>'conversationId')::uuid or r.lease_token is distinct from (p_input->>'leaseToken')::uuid) then raise exception 'Supplemental capability unavailable';end if;
  select * into l from leads where tenant_id=t and conversation_id=r.conversation_id and first_customer_at<=(select created_at from chat_messages where tenant_id=t and id=r.trigger_message_id)
   and (closed_at is null or closed_at>=(select created_at from chat_messages where tenant_id=t and id=r.trigger_message_id)) order by created_at desc,id desc limit 1;
  select * into p from chat_knowledge_packs where tenant_id=t and id=r.pack_id and status='published';
  delivery_kind:=p_input->>'kind';
  if l.id is null or p.id is null or delivery_kind not in ('price_image','review') then raise exception 'Supplemental unavailable';end if;
  if exists(select 1 from chat_messages m join chat_messages trigger on trigger.tenant_id=t and trigger.id=r.trigger_message_id
   where m.tenant_id=t and m.conversation_id=r.conversation_id and m.author='customer' and not m.private and (m.created_at,m.chatwoot_message_id)>(trigger.created_at,trigger.chatwoot_message_id))
   then return jsonb_build_object('status','unavailable');end if;
  if delivery_kind='price_image' and exists(select 1 from jsonb_array_elements(coalesce(r.result_json#>'{understanding,signals}','[]')) s
   join chat_messages m on m.tenant_id=t and m.id=(s->>'messageId')::uuid and m.conversation_id=l.conversation_id and m.author='customer' and not m.private
   where s->>'kind'='price_list' and nullif(s->>'quote','') is not null and strpos(coalesce(m.content,''),s->>'quote')>0) and nullif(p.pack_json->>'priceListImageUrl','') is not null and nullif(p.pack_json#>>'{media,priceListCaption}','') is not null then
   insert into chat_supplemental_deliveries(tenant_id,lead_id,conversation_id,contact_id,run_id,pack_id,kind,text,asset_url)
   values(t,l.id,l.conversation_id,l.contact_id,r.id,p.id,delivery_kind,p.pack_json#>>'{media,priceListCaption}',p.pack_json->>'priceListImageUrl')
   on conflict (tenant_id,conversation_id) where kind='price_image' do update set lead_id=excluded.lead_id,contact_id=excluded.contact_id,run_id=excluded.run_id,pack_id=excluded.pack_id,text=excluded.text,asset_url=excluded.asset_url
   where chat_supplemental_deliveries.state='draft';
  elsif delivery_kind='review' and exists(select 1 from orders where tenant_id=t and id=l.order_id and customer_id=l.customer_id and deleted_at is null and order_status='delivered' and source<>'shopify' and updated_at>=l.first_customer_at) and coalesce((p.pack_json#>>'{review,enabled}')::boolean,false) and nullif(p.pack_json#>>'{review,text}','') is not null then
   insert into chat_supplemental_deliveries(tenant_id,lead_id,conversation_id,contact_id,run_id,pack_id,kind,text,order_id)
   values(t,l.id,l.conversation_id,l.contact_id,r.id,p.id,delivery_kind,(p.pack_json#>>'{review,text}')||chr(10)||(p.pack_json#>>'{review,url}'),l.order_id)
   on conflict (tenant_id,conversation_id,order_id) where kind='review' do update set lead_id=excluded.lead_id,contact_id=excluded.contact_id,run_id=excluded.run_id,pack_id=excluded.pack_id,text=excluded.text
   where chat_supplemental_deliveries.state='draft';
  end if;
  select * into d from chat_supplemental_deliveries where tenant_id=t and conversation_id=l.conversation_id and kind=p_input->>'kind' and (kind='price_image' or order_id=l.order_id) for update;
  if d.id is null then return jsonb_build_object('status','unavailable');end if;
 else select * into d from chat_supplemental_deliveries where tenant_id=t and id=(p_input->>'id')::uuid for update;
 end if;
 if d.id is null then raise exception 'Supplemental unavailable';end if;
 if not staff and (d.conversation_id is distinct from (p_input->>'conversationId')::uuid or d.run_id is distinct from (p_input->>'runId')::uuid) then raise exception 'Supplemental scope mismatch';end if;
 if p_action='prepare' then
  if chat_supplemental_valid(t,d.id) is not true then return jsonb_build_object('status','unavailable');end if;
  return jsonb_build_object('status',d.state,'id',d.id);
 end if;
 if p_action in ('record','uncertain') then
  if d.state='sent' and p_action='record' and d.provider_message_id=(p_input->>'providerMessageId')::bigint then return jsonb_build_object('status','sent');end if;
  if d.state<>'sending' then raise exception 'Supplemental receipt unavailable';end if;
  update chat_supplemental_deliveries set state=case when p_action='record' then 'sent' else 'uncertain' end,
   provider_message_id=(p_input->>'providerMessageId')::bigint,sent_at=case when p_action='record' then now() else null end where tenant_id=t and id=d.id;
  perform chat_lead_event(p_context,d.lead_id,'supplemental.'||p_action,jsonb_build_object('id',d.id,'kind',d.kind));
  return jsonb_build_object('status',case when p_action='record' then 'sent' else 'uncertain' end);
 end if;
 -- Reserve review cooldown across conversations before any network action.
 perform 1 from chat_contacts where tenant_id=t and id=d.contact_id for update;
 select * into r from chat_agent_runs where tenant_id=t and id=d.run_id;
 select * into c from chat_channels where tenant_id=t and id=r.channel_id and is_active for share;
 select * into v from chat_conversations where tenant_id=t and id=d.conversation_id;
 if c.id is null or not exists(select 1 from chat_workspaces where tenant_id=t and id=c.workspace_id and status='active')
  or chat_supplemental_valid(t,d.id) is not true or v.quiet_until>now() or v.last_customer_at<now()-interval '24 hours'
  or exists(select 1 from chat_messages m join chat_messages trigger on trigger.tenant_id=t and trigger.id=r.trigger_message_id
   where m.tenant_id=t and m.conversation_id=d.conversation_id and m.author='customer' and not m.private and (m.created_at,m.chatwoot_message_id)>(trigger.created_at,trigger.chatwoot_message_id))
  then raise exception 'Supplemental eligibility changed';end if;
 if not staff and not exists(select 1 from chat_channel_action_approvals a join tenant_users u on u.tenant_id=t and u.id=a.approved_by and u.status='active' and u.role='owner_admin'
  where a.tenant_id=t and a.channel_id=c.id and a.pack_id=d.pack_id and a.approved_at is not null and c.agent_mode='auto') then raise exception 'Supplemental approval changed';end if;
 if p_action='claim' then
  if d.state<>'draft' then return jsonb_build_object('status',d.state);end if;
  update chat_supplemental_deliveries set state='sending' where tenant_id=t and id=d.id;
 elsif d.state<>'sending' then raise exception 'Supplemental already claimed';end if;
 return jsonb_build_object('status','claimed','id',d.id,'kind',d.kind,'text',d.text,'assetUrl',d.asset_url,'workspaceId',c.workspace_id,
  'accountId',(select chatwoot_account_id from chat_workspaces where tenant_id=t and id=c.workspace_id),'conversationId',v.chatwoot_conversation_id);
end $$;
revoke all on function chat_supplemental_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_supplemental_command(jsonb,text,jsonb) to service_role;
create function chat_supplemental_read(p_tenant uuid,p_lead uuid) returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'state',d.state,'text',d.text,'assetUrl',d.asset_url,'sentAt',d.sent_at,'eligible',coalesce(chat_supplemental_valid(p_tenant,d.id),false)) order by d.created_at desc),'[]')
 from (select * from chat_supplemental_deliveries where tenant_id=p_tenant and lead_id=p_lead order by created_at desc,id desc limit 50) d
$$;
revoke all on function chat_supplemental_read(uuid,uuid) from public,anon,authenticated,service_role;
commit;
