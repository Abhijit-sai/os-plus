begin;
-- Read-only evidence aggregation. Private drafts/system messages are never reply receipts.
create function chat_notification_metrics(t uuid,a timestamptz,b timestamptz,brands uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
with conv as (
 select v.id from chat_conversations v join chat_channels c on c.tenant_id=t and c.id=v.channel_id
 where v.tenant_id=t and (cardinality(brands)=0 or c.brand_id=any(brands))
), msg as (
 select m.* from chat_messages m join conv c on c.id=m.conversation_id
 where m.tenant_id=t and m.created_at>=a and m.created_at<b and not m.private
), first_customer as (
 select distinct on(conversation_id) conversation_id,created_at,chatwoot_message_id from msg where author='customer'
 order by conversation_id,created_at,chatwoot_message_id
), waits as (
 select f.conversation_id,extract(epoch from (r.created_at-f.created_at)) seconds from first_customer f
 left join lateral (
  select m.created_at from chat_messages m where m.tenant_id=t and m.conversation_id=f.conversation_id
   and not m.private and m.author in ('bot','staff') and m.created_at<b
   and (m.created_at,m.chatwoot_message_id)>(f.created_at,f.chatwoot_message_id)
   order by m.created_at,m.chatwoot_message_id limit 1
 ) r on true
), lead as (
 select l.* from leads l where l.tenant_id=t and (cardinality(brands)=0 or l.brand_id=any(brands))
), reason as (
 select r.* from chat_task_reasons r join chat_task_records rec on rec.tenant_id=t and rec.id=r.record_id
 join lead l on l.id=rec.lead_id where r.tenant_id=t and r.created_at>=a and r.created_at<b
), cost as (
 select e.* from chat_agent_cost_entries e join chat_agent_runs r on r.tenant_id=t and r.id=e.run_id
 join chat_channels c on c.tenant_id=t and c.id=r.channel_id
 where e.tenant_id=t and e.created_at>=a and e.created_at<b and (cardinality(brands)=0 or c.brand_id=any(brands))
)
select jsonb_build_object(
 'chats',(select count(*) from first_customer),
 'customerMessages',(select count(*) from msg where author='customer'),
 'botReplies',(select count(*) from msg where author='bot'),
 'staffReplies',(select count(*) from msg where author='staff'),
 'medianReplySeconds',(select round((percentile_cont(0.5) within group(order by seconds))::numeric,3) from waits where seconds is not null),
 'unansweredChats',(select count(*) from waits where seconds is null),
 'handoffs',(select count(distinct record_id) from reason),
 'handoffReasons',coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from reason group by reason) counts),'{}'::jsonb),
 'requests',(select count(*) from chat_action_requests where tenant_id=t and created_at>=a and created_at<b and (cardinality(brands)=0 or brand_id=any(brands))),
 'operationalActions',(select count(*) from chat_action_requests where tenant_id=t and approved_at>=a and approved_at<b and (cardinality(brands)=0 or brand_id=any(brands))),
 'confirmedBookings',(select count(distinct e.lead_id) from lead_events e join lead l on l.id=e.lead_id where e.tenant_id=t and e.at>=a and e.at<b and e.kind='stage' and e.meta_json->>'to'='booked'),
 'paymentClaims',(select count(distinct message_id) from reason where reason='payment_claim'),
 'tasks',(select count(*) from chat_task_records rec join lead l on l.id=rec.lead_id where rec.tenant_id=t and rec.created_at>=a and rec.created_at<b),
 'newLeads',(select count(*) from lead where created_at>=a and created_at<b),
 'wonLeads',(select count(*) from lead where kind='sales' and stage='won' and closed_at>=a and closed_at<b),
 'wonEstimatedValue',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'amount',amount) order by currency) from
  (select currency,sum(est_value) amount from lead where kind='sales' and stage='won' and closed_at>=a and closed_at<b and est_value is not null group by currency) money),'[]'::jsonb),
 'errors',(select count(*) from chat_turns r join conv c on c.id=r.conversation_id where r.tenant_id=t and r.created_at>=a and r.created_at<b and (r.outcome='error' or r.decision_json->>'reason'='unavailable_or_unsafe' or r.decision_json->>'delivery'='uncertain')),
 'cost',jsonb_build_object('knownUsd',(select coalesce(sum(actual_usd) filter(where state='settled'),0) from cost)+
  (select coalesce(sum(r.cost_usd),0) from chat_turns r join conv c on c.id=r.conversation_id
   where r.tenant_id=t and r.created_at>=a and r.created_at<b and not exists(
    select 1 from chat_agent_runs ar join chat_agent_cost_entries e on e.tenant_id=t and e.run_id=ar.id where ar.tenant_id=t and ar.turn_id=r.id)),'unsettledCalls',(select count(*) from cost where state<>'settled'))
);
$$;
revoke all on function chat_notification_metrics(uuid,timestamptz,timestamptz,uuid[]) from public,anon,authenticated,service_role;

create function chat_notification_summary(t uuid,a timestamptz,b timestamptz,brands uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('version',1,'localDate',to_char(b at time zone s.timezone,'YYYY-MM-DD'),'timezone',s.timezone,
  'windowStart',to_char(a at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'windowEnd',to_char(b at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'totals',chat_notification_metrics(t,a,b,brands),
  'brands',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'metrics',chat_notification_metrics(t,a,b,array[c.id])) order by c.name,c.id)
   from chat_brands c where c.tenant_id=t and (cardinality(brands)=0 or c.id=any(brands))),'[]'::jsonb),
  'judge',jsonb_build_object('status','not_evaluated'))
 from chat_settings s where s.tenant_id=t;
$$;
revoke all on function chat_notification_summary(uuid,timestamptz,timestamptz,uuid[]) from public,anon,authenticated,service_role;

create function chat_notification_preview(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid; a timestamptz:=(p_input->>'windowStart')::timestamptz;b timestamptz:=(p_input->>'windowEnd')::timestamptz; brands uuid[];
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner report access required';end if;
 if a is null or b is null or not isfinite(a) or not isfinite(b) or a>=b or b>clock_timestamp() or b-a>interval '31 days'
  or jsonb_typeof(p_input->'brandIds') is distinct from 'array' or jsonb_array_length(p_input->'brandIds')>100 then raise exception 'Invalid report window';end if;
 select coalesce(array_agg(distinct value::uuid),'{}') into brands from jsonb_array_elements_text(p_input->'brandIds');
 if (select count(*) from chat_brands where tenant_id=t and id=any(brands))<>cardinality(brands) then raise exception 'Brand unavailable';end if;
 return chat_notification_summary(t,a,b,brands);
end $$;
revoke all on function chat_notification_preview(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_notification_preview(jsonb,jsonb) to service_role;
commit;
