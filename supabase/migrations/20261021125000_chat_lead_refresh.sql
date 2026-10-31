begin;
-- Stage maintenance is explicit/tenant-scoped. This installs no scheduler and sends nothing.
create function public.chat_lead_refresh(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; r leads%rowtype; o orders%rowtype; pickup laundry_pickup_requests%rowtype;
 next_stage text; reason text; days integer; active_booking boolean; confirmed_booking boolean; real_order boolean;
 updated integer:=0; scanned integer:=0; cursor_id uuid; retained jsonb;
begin
 if p_context#>>'{actor,type}'='USER' then perform chat_lead_authorize(p_context);
 elsif p_context#>>'{actor,type}'='SYSTEM' and p_context#>>'{actor,id}'='chat-stage-refresh' and p_context->>'source'='AUTOMATION'
  and nullif(btrim(p_context->>'correlationId'),'') is not null then
  perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
  perform 1 from tenants where id=t and status='active' for share;
  if not found then raise exception 'Lead access denied'; end if;
  perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled for share;
  if not found then raise exception 'Lead access denied'; end if;
 else raise exception 'Invalid refresh context'; end if;
 select lost_after_days into days from chat_settings where tenant_id=t;
 for r in select * from leads where tenant_id=t and (p_input->>'leadId' is null or id=(p_input->>'leadId')::uuid)
  and (p_input->>'afterId' is null or id>(p_input->>'afterId')::uuid)
  order by id limit 100 for update loop
  scanned:=scanned+1; cursor_id:=r.id;
  update leads set est_value=chat_lead_value(t,r.customer_id,r.brand_id,r.kind,r.currency),version=version+1 where tenant_id=t and id=r.id
   and est_value is distinct from chat_lead_value(t,r.customer_id,r.brand_id,r.kind,r.currency);
  if found then perform chat_lead_event(p_context,r.id,'value',jsonb_build_object('reason','actual_history_or_published_pack')); end if;
  if r.kind<>'sales' or r.stage in ('won','lost') then continue; end if;
  o:=null; retained:=null; active_booking:=false; confirmed_booking:=false; next_stage:=r.stage; reason:=null;
  select * into o from orders where tenant_id=t and id=r.order_id and customer_id=r.customer_id and deleted_at is null and order_status not in ('draft','cancelled') for share;
  real_order:=found;
  if real_order then
   if o.source='shopify' then
    -- Retained normalized facts survive raw payload expiry; no import is messaging consent.
    select case when d.details is not null then jsonb_set(d.details,'{payment,productionHeld}',to_jsonb(coalesce(st.held,true))) end into retained
     from shopify_source_orders so
     join shopify_connections connection on connection.tenant_id=so.tenant_id and connection.id=so.connection_id
      and connection.shop_gid=so.shop_gid and connection.environment='production'
     join lateral(select revision.id from shopify_source_revisions revision where revision.tenant_id=so.tenant_id
      and revision.source_order_id=so.id order by revision.generation desc limit 1) newest on true
     left join shopify_commercial_details d on d.tenant_id=so.tenant_id and d.source_order_id=so.id and d.revision_id=newest.id
     left join shopify_operational_state st on st.tenant_id=so.tenant_id and st.source_order_id=so.id
     where so.tenant_id=t and so.order_id=o.id;
    -- Match read_shopify_retained_payment: missing state is held, and missing latest
    -- normalized details must never fall back to a previous generation's PAID facts.
   end if;
   if o.payment_status='paid' or o.order_status='delivered'
    or (retained#>>'{payment,availability}'='available' and retained#>>'{payment,status}'='PAID'
     and retained#>>'{payment,validation}'='source_consistent' and retained#>>'{payment,productionHeld}'='false'
     and retained->>'cancelledAt' is null) then next_stage:='won'; reason:='linked_order_paid_or_delivered';
   else next_stage:='in_progress'; reason:='linked_order'; end if;
  else
   if r.booking_subject_type='laundry_pickup_request' then
    select * into pickup from laundry_pickup_requests where tenant_id=t and id=r.booking_subject_id and customer_id=r.customer_id and deleted_at is null for share;
    if found then active_booking:=pickup.status not in ('FAILED','CANCELLED','PICKED_UP');
     confirmed_booking:=pickup.status in ('SCHEDULED','ASSIGNED','OUT_FOR_PICKUP','PICKED_UP'); end if;
   elsif r.booking_subject_type='task' then
    select exists(select 1 from tasks where tenant_id=t and id=r.booking_subject_id and deleted_at is null
     and task_type='LEAD_FOLLOW_UP' and status not in ('CANCELLED','COMPLETED')
     and ((subject_type='lead' and subject_id=r.id) or (subject_type='chat_conversation' and subject_id=r.conversation_id))) into active_booking;
    -- Task existence is not customer confirmation; booking capability arrives later.
   end if;
   if confirmed_booking and r.stage in ('new','engaged') then next_stage:='booked'; reason:='confirmed_booking';
   elsif not active_booking and r.stage in ('new','engaged') and r.last_customer_at<=now()-make_interval(days=>coalesce(days,7))
    then next_stage:='lost'; reason:='customer_silence'; end if;
  end if;
  if next_stage<>r.stage then
   update leads set stage=next_stage,closed_at=case when next_stage in ('won','lost') then now() else null end,
    lost_reason=case when next_stage='lost' then reason else null end,version=version+1 where tenant_id=t and id=r.id;
   perform chat_lead_event(p_context,r.id,'stage',jsonb_build_object('from',r.stage,'to',next_stage,'reason',reason));
   updated:=updated+1;
  end if;
 end loop;
 return jsonb_build_object('scanned',scanned,'updated',updated,'nextAfterId',case when scanned=100 then cursor_id else null end);
end $$;
revoke all on function chat_lead_refresh(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_lead_refresh(jsonb,jsonb) to service_role;
-- Explicit maintenance for pre-CH-3 stored messages. Uses only retained facts;
-- never fabricates source/phone possession from an absent historical profile.
create function public.chat_lead_backfill(p_context jsonb,p_after_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; m record; scanned integer:=0; cursor_id uuid;
begin
 if p_context#>>'{actor,type}'='USER' then t:=chat_lead_authorize(p_context);
 elsif p_context#>>'{actor,type}'='SYSTEM' and p_context#>>'{actor,id}'='chat-history-backfill'
  and p_context->>'source'='AUTOMATION' and nullif(btrim(p_context->>'correlationId'),'') is not null then
  t:=(p_context->>'tenantId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
  perform 1 from tenants where id=t and status='active' for share;
  if not found then raise exception 'Lead access denied'; end if;
  perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled for share;
  if not found then raise exception 'Lead access denied'; end if;
 else raise exception 'Invalid backfill context'; end if;
 for m in select msg.id,msg.conversation_id,c.workspace_id
  from chat_messages msg join chat_conversations cv on cv.tenant_id=msg.tenant_id and cv.id=msg.conversation_id
  join chat_channels c on c.tenant_id=cv.tenant_id and c.id=cv.channel_id
  where msg.tenant_id=t and (p_after_id is null or msg.id>p_after_id)
  order by msg.id limit 100 loop
  perform chat_enrich_capture(p_context,jsonb_build_object('workspaceId',m.workspace_id),
   jsonb_build_object('messageId',m.id,'conversationId',m.conversation_id));
  scanned:=scanned+1;cursor_id:=m.id;
 end loop;
 return jsonb_build_object('scanned',scanned,'nextAfterId',case when scanned=100 then cursor_id else null end);
end $$;
revoke all on function chat_lead_backfill(jsonb,uuid) from public,anon,authenticated;
grant execute on function chat_lead_backfill(jsonb,uuid) to service_role;
commit;
