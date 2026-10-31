begin;
alter table chat_summary_runs add column window_start timestamptz,add column window_end timestamptz,
 add column reporting_timezone text,add column state text not null default 'queued' check(state in ('queued','sent','partial')),
 add constraint chat_summary_window check((window_start is null and window_end is null) or (window_start is not null and window_end>window_start));
alter table chat_settings add column notification_scanned_at timestamptz;
create table chat_notification_outbox(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 target_id uuid not null,target_version integer not null check(target_version>0),settings_version integer not null check(settings_version>0),
 kind text not null check(kind in ('booking_request','handoff','payment_claim','agent_failure','daily_summary','new_lead')),
 source_key text not null check(length(source_key) between 1 and 200),summary_run_id uuid,brand_id uuid,lead_id uuid,
 payload_json jsonb not null check(jsonb_typeof(payload_json)='object' and octet_length(payload_json::text)<=2000000),
 state text not null default 'queued' check(state in ('queued','sending','sent','uncertain','cancelled')),
 claim_token uuid,attempted_at timestamptz,sent_at timestamptz,provider_message_id bigint check(provider_message_id>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,target_id,kind,source_key),
 foreign key(tenant_id,target_id) references chat_notification_targets(tenant_id,id),
 foreign key(tenant_id,summary_run_id) references chat_summary_runs(tenant_id,id),
 foreign key(tenant_id,brand_id) references chat_brands(tenant_id,id),
 foreign key(tenant_id,lead_id) references leads(tenant_id,id),
 check((kind='daily_summary')=(summary_run_id is not null)),
 check(state<>'sent' or (sent_at is not null and provider_message_id is not null))
);
create index chat_notification_pending on chat_notification_outbox(tenant_id,created_at,id) where state='queued';
alter table chat_notification_outbox enable row level security;
revoke all on chat_notification_outbox from public,anon,authenticated,service_role;
grant select on chat_notification_outbox to service_role;
create trigger chat_notification_outbox_updated before update on chat_notification_outbox for each row execute function set_updated_at();

create function chat_notification_sources(t uuid,since timestamptz)
returns table(source_key text,kind text,brand_id uuid,lead_id uuid,occurred_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select 'request:'||r.id,'booking_request',r.brand_id,r.lead_id,r.created_at from chat_action_requests r where r.tenant_id=t and r.created_at>=since
 union all
 select 'reason:'||r.id,case when r.reason='payment_claim' then 'payment_claim' else 'handoff' end,l.brand_id,l.id,r.created_at
 from chat_task_reasons r join chat_task_records tr on tr.tenant_id=t and tr.id=r.record_id join leads l on l.tenant_id=t and l.id=tr.lead_id
 where r.tenant_id=t and r.created_at>=since
 union all
 select 'lead:'||l.id,'new_lead',l.brand_id,l.id,l.created_at from leads l where l.tenant_id=t and l.created_at>=since and l.first_customer_at>=since
 union all
 select 'turn:'||r.id,'agent_failure',c.brand_id,lead.id,coalesce(ar.updated_at,r.created_at) from chat_turns r
 join chat_conversations v on v.tenant_id=t and v.id=r.conversation_id join chat_channels c on c.tenant_id=t and c.id=v.channel_id
 left join chat_agent_runs ar on ar.tenant_id=t and ar.turn_id=r.id
 left join lateral(select id from leads where tenant_id=t and conversation_id=v.id and first_customer_at<=r.created_at order by first_customer_at desc,id limit 1) lead on true
 where r.tenant_id=t and (r.outcome='error' or r.decision_json->>'reason'='unavailable_or_unsafe' or ar.status='uncertain')
  and coalesce(ar.updated_at,r.created_at)>=since;
$$;
revoke all on function chat_notification_sources(uuid,timestamptz) from public,anon,authenticated,service_role;

create function chat_notification_reconcile(t uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
 with states as (
  select summary_run_id,bool_and(state='sent') all_sent,bool_or(state in ('queued','sending')) pending,max(sent_at) delivered_at
  from chat_notification_outbox where tenant_id=t and summary_run_id is not null group by summary_run_id
 ), next as (
  select summary_run_id,case when all_sent then 'sent' when pending then 'queued' else 'partial' end state,
   case when all_sent then delivered_at else null end sent_at from states
 )
 update chat_summary_runs r set state=n.state,sent_at=n.sent_at from next n
 where r.tenant_id=t and r.id=n.summary_run_id and (r.state is distinct from n.state or r.sent_at is distinct from n.sent_at);
$$;
revoke all on function chat_notification_reconcile(uuid) from public,anon,authenticated,service_role;
create function chat_notification_sweep(ctx jsonb,enabled boolean,v integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(ctx->>'tenantId')::uuid; item chat_notification_outbox%rowtype;
begin
 for item in update chat_notification_outbox o set state=case when o.state='sending' then 'uncertain' else 'cancelled' end
 where o.tenant_id=t and ((o.state='sending' and o.attempted_at<now()-interval '2 minutes') or
 (o.state='queued' and (not enabled or o.settings_version is distinct from v or o.created_at<now()-interval '26 hours'
 or (o.brand_id is not null and not exists(select 1 from chat_brands b where b.tenant_id=t and b.id=o.brand_id and b.is_active and b.deleted_at is null)) or not exists(
 select 1 from chat_notification_targets n where n.tenant_id=t and n.id=o.target_id and n.is_active and n.version=o.target_version
  and n.confirmed_at is not null and o.kind=any(n.events))))) returning o.* loop
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
  values(t,'chat.notification.delivery_'||item.state,'chat_notification_outbox',item.id,'SYSTEM','chat-notifications','AUTOMATION',ctx->>'correlationId',jsonb_build_object('kind',item.kind));
 end loop;
 perform chat_notification_reconcile(t);
end $$;
revoke all on function chat_notification_sweep(jsonb,boolean,integer) from public,anon,authenticated,service_role;

create function chat_notification_slot(zone text,cutoff time,moment timestamptz) returns jsonb
language plpgsql stable set search_path=public,pg_temp as $$
declare d date;ending timestamptz;starting timestamptz;
begin
 if moment is null or not isfinite(moment) or cutoff is null or not exists(select 1 from pg_timezone_names where name=zone)
  then raise exception 'Invalid notification calendar';end if;
 d:=(moment at time zone zone)::date;ending:=(d+cutoff) at time zone zone;
 -- PostgreSQL selects the later standard-time occurrence on an ambiguous fall-back cutoff.
 if ending>moment then d:=d-1;ending:=(d+cutoff) at time zone zone;end if;
 starting:=((d-1)+cutoff) at time zone zone;
 return jsonb_build_object('localDate',d,'windowStart',starting,'windowEnd',ending);
end $$;
revoke all on function chat_notification_slot(text,time,timestamptz) from public,anon,authenticated,service_role;

create function chat_notification_dispatch(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;s chat_settings%rowtype;d date;a timestamptz;b timestamptz;
 runid uuid;made boolean:=false;target chat_notification_targets%rowtype;brands uuid[];payload jsonb; item chat_notification_outbox%rowtype;allowed boolean;src record;queued_id uuid;slot jsonb;
begin
 if p_context#>>'{actor,type}' is distinct from 'SYSTEM' or p_context#>>'{actor,id}' is distinct from 'chat-notifications'
  or p_context->>'source' is distinct from 'AUTOMATION' or nullif(btrim(p_context->>'correlationId'),'') is null or (p_action is null or p_action not in ('prepare','claim','authorize','record','uncertain'))
  then raise exception 'Invalid notification worker context';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 if p_action in ('record','uncertain') then
  select * into item from chat_notification_outbox where tenant_id=t and id=(p_input->>'id')::uuid and claim_token=(p_input->>'token')::uuid for update;
  if not found then raise exception 'Delivery claim unavailable';end if;
  if item.state='sent' then return jsonb_build_object('status','sent');end if;
  if item.state not in ('sending','uncertain') then raise exception 'Delivery claim changed';end if;
  if p_action='record' and (p_input->>'messageId' is null or (p_input->>'messageId')::numeric not between 1 and 9007199254740991)
   then raise exception 'Invalid delivery receipt';end if;
  update chat_notification_outbox set state=case when p_action='record' then 'sent' else 'uncertain' end,
   sent_at=case when p_action='record' then now() else null end,
   provider_message_id=case when p_action='record' then (p_input->>'messageId')::bigint else null end
   where tenant_id=t and id=item.id returning * into item;
  perform chat_notification_reconcile(t);
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.notification.delivery_'||item.state,'chat_notification_outbox',item.id,'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId',jsonb_build_object('kind',item.kind));
  return jsonb_build_object('status',item.state);
 end if;
 perform 1 from tenants a join tenant_modules m on m.tenant_id=a.id and m.module_key='chat_leads' and m.is_enabled
  where a.id=t and a.status='active' for share of a,m;
 if not found then perform chat_notification_sweep(p_context,false,null);return case when p_action='prepare' then jsonb_build_object('summaryCreated',false) when p_action='authorize' then jsonb_build_object('allowed',false) else jsonb_build_object('status','none') end;end if;
 select * into s from chat_settings where tenant_id=t for update;
 if not found or not s.notifications_enabled then perform chat_notification_sweep(p_context,false,null);return case when p_action='prepare' then jsonb_build_object('summaryCreated',false) when p_action='authorize' then jsonb_build_object('allowed',false) else jsonb_build_object('status','none') end;end if;
 if p_action='authorize' then
  select * into item from chat_notification_outbox where tenant_id=t and id=(p_input->>'id')::uuid and claim_token=(p_input->>'token')::uuid and state='sending' for update;
  if not found then return jsonb_build_object('allowed',false);end if;
  select * into target from chat_notification_targets where tenant_id=t and id=item.target_id for share;
  allowed:=target.is_active and target.version=item.target_version and s.notification_version=item.settings_version
   and target.confirmed_at is not null and item.kind=any(target.events) and item.attempted_at>clock_timestamp()-interval '30 seconds'
   and (item.brand_id is null or (exists(select 1 from chat_brands b where b.tenant_id=t and b.id=item.brand_id and b.is_active and b.deleted_at is null)
    and (not exists(select 1 from chat_notification_target_brands where tenant_id=t and target_id=target.id)
     or exists(select 1 from chat_notification_target_brands where tenant_id=t and target_id=target.id and brand_id=item.brand_id))));
  if not coalesce(allowed,false) then
   update chat_notification_outbox set state='cancelled' where tenant_id=t and id=item.id;
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
    values(t,'chat.notification.delivery_cancelled','chat_notification_outbox',item.id,'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId',jsonb_build_object('kind',item.kind));
   perform chat_notification_reconcile(t);
  end if;
  return jsonb_build_object('allowed',coalesce(allowed,false));
 elsif p_action='claim' then
  -- Abandoned attempts are held; revocation closes queued work with an audit trail.
  perform chat_notification_sweep(p_context,true,s.notification_version);
  select * into item from chat_notification_outbox where tenant_id=t and state='queued' order by created_at,id limit 1 for update;
  if not found then return jsonb_build_object('status','none');end if;
  select * into target from chat_notification_targets where tenant_id=t and id=item.target_id for share;
  update chat_notification_outbox set state='sending',claim_token=gen_random_uuid(),attempted_at=clock_timestamp() where tenant_id=t and id=item.id returning * into item;
  insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
   values(t,'chat.notification.delivery_claimed','chat_notification_outbox',item.id,'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId',jsonb_build_object('kind',item.kind));
  return jsonb_build_object('status','claimed','id',item.id,'token',item.claim_token,'targetId',target.id,'recipientEnc',target.recipient_enc,'kind',item.kind,'payload',item.payload_json);
 end if;
 update chat_settings set notification_scanned_at=now() where tenant_id=t;
 slot:=chat_notification_slot(s.timezone,s.summary_local_time,now());d:=(slot->>'localDate')::date;b:=(slot->>'windowEnd')::timestamptz;
 if not exists(select 1 from chat_summary_runs where tenant_id=t and local_date=d)
  and exists(select 1 from chat_notification_targets where tenant_id=t and is_active and recipient_kind='private'
   and confirmed_at is not null and 'daily_summary'=any(events) and activated_at<=b) then
  select max(window_end) into a from chat_summary_runs where tenant_id=t;
  if a is null then a:=(slot->>'windowStart')::timestamptz;end if;
  if a<b then
   payload:=chat_notification_summary(t,a,b,'{}');
   insert into chat_summary_runs(tenant_id,local_date,window_start,window_end,reporting_timezone,payload_json,created_by,updated_by)
    values(t,d,a,b,s.timezone,payload,'chat-notifications','chat-notifications') returning id into runid;
   for target in select * from chat_notification_targets where tenant_id=t and is_active and recipient_kind='private'
    and confirmed_at is not null and 'daily_summary'=any(events) and activated_at<=b order by id for share loop
    select coalesce(array_agg(brand_id),'{}') into brands from chat_notification_target_brands where tenant_id=t and target_id=target.id;
    payload:=chat_notification_summary(t,a,b,brands);
    insert into chat_notification_outbox(tenant_id,target_id,target_version,settings_version,kind,source_key,summary_run_id,payload_json)
     values(t,target.id,target.version,s.notification_version,'daily_summary',d::text,runid,payload);
   end loop;
   insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
    values(t,'chat.summary.prepared','chat_summary_run',runid,'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId',
     jsonb_build_object('localDate',d,'windowStart',a,'windowEnd',b));
   made:=true;
  end if;
 end if;
 for target in select * from chat_notification_targets where tenant_id=t and is_active and confirmed_at is not null order by id for share loop
  for src in select e.*,brand.name from chat_notification_sources(t,greatest(target.activated_at,now()-interval '24 hours')) e
   join chat_brands brand on brand.tenant_id=t and brand.id=e.brand_id and brand.is_active and brand.deleted_at is null
   where e.kind=any(target.events) and e.occurred_at<=now()
    and (not exists(select 1 from chat_notification_target_brands where tenant_id=t and target_id=target.id)
     or exists(select 1 from chat_notification_target_brands where tenant_id=t and target_id=target.id and brand_id=e.brand_id))
    and not exists(select 1 from chat_notification_outbox where tenant_id=t and target_id=target.id and kind=e.kind and source_key=e.source_key)
   order by e.occurred_at,e.source_key limit 50 loop
   insert into chat_notification_outbox(tenant_id,target_id,target_version,settings_version,kind,source_key,brand_id,lead_id,payload_json)
    values(t,target.id,target.version,s.notification_version,src.kind,src.source_key,src.brand_id,src.lead_id,
     jsonb_build_object('kind',src.kind,'brand',src.name,'leadId',src.lead_id)) on conflict do nothing returning id into queued_id;
   if queued_id is not null then
    insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
     values(t,'chat.notification.queued','chat_notification_outbox',queued_id,'SYSTEM','chat-notifications','AUTOMATION',p_context->>'correlationId',jsonb_build_object('kind',src.kind));
   end if;
  end loop;
 end loop;
 return jsonb_build_object('summaryCreated',made);
end $$;
revoke all on function chat_notification_dispatch(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function chat_notification_dispatch(jsonb,text,jsonb) to service_role;
create function chat_notification_tenants(p_limit integer default 5) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(id),'[]'::jsonb) from (
  select t.id from tenants t join tenant_modules m on m.tenant_id=t.id and m.module_key='chat_leads' and m.is_enabled
   join chat_settings s on s.tenant_id=t.id and s.notifications_enabled where t.status='active'
   order by s.notification_scanned_at nulls first,t.id limit least(greatest(coalesce(p_limit,5),1),5)
 ) due;
$$;
revoke all on function chat_notification_tenants(integer) from public,anon,authenticated;
grant execute on function chat_notification_tenants(integer) to service_role;
commit;
