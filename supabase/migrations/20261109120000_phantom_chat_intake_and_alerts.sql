begin;

create function public.chat_uses_phantom_workflow(t uuid) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select t in ('364f9052-2ec4-45c1-aeca-70618b37265c'::uuid,
               '7be40f50-94a0-46c5-af57-7eea5e36ea8a'::uuid)
$$;
revoke all on function public.chat_uses_phantom_workflow(uuid) from public,anon,authenticated,service_role;

-- Project only the fact of a photo. No attachment URLs or provider identifiers enter the model context.
do $$
declare
  definition text := pg_get_functiondef('public.chat_agent_load(jsonb,jsonb)'::regprocedure);
  anchor text := $old$return data||jsonb_build_object('messages',messages$old$;
  projection text := $new$if chat_uses_phantom_workflow(t) and data->>'channelKind'='whatsapp' and data->>'agentMode'='auto' then
    select coalesce(jsonb_agg(case when m.attachments_json @> '[{"file_type":"image"}]'
      then x||'{"hasImage":true}'::jsonb else x end order by ord),'[]'::jsonb) into messages
    from jsonb_array_elements(messages) with ordinality as a(x,ord)
    left join chat_messages m on m.tenant_id=t and m.conversation_id=msg.conversation_id
      and m.id=(x->>'id')::uuid and m.author='customer' and not m.private;
  end if;
  return data||jsonb_build_object('messages',messages$new$;
begin
  if strpos(definition,anchor)=0 then raise exception 'Unexpected chat_agent_load definition'; end if;
  execute replace(definition,anchor,projection);
end $$;

do $$
declare
  definition text := pg_get_functiondef('public.chat_live_agent_run(jsonb,text,jsonb)'::regprocedure);
  anchor text := $old$lead.id,run.trigger_message_id,'staff_requested',null);$old$;
  replacement text := $new$lead.id,run.trigger_message_id,case
          when chat_uses_phantom_workflow(t) and run.result_json @> '{"decision":{"phantomPaymentClaim":true}}'
          then 'payment_claim' else 'staff_requested' end,null);$new$;
begin
  if strpos(definition,anchor)=0 then raise exception 'Unexpected chat_live_agent_run definition'; end if;
  execute replace(definition,anchor,replacement);
end $$;

-- Compare actionable evidence within a staff task. Keep the original source key so an
-- already delivered alert stays delivered across an application or database rollout.
create or replace function public.chat_notification_sources(t uuid,since timestamptz)
returns table(source_key text,kind text,brand_id uuid,lead_id uuid,occurred_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select 'request:'||r.id,'booking_request',r.brand_id,r.lead_id,r.created_at
 from chat_action_requests r where r.tenant_id=t and r.created_at>=since
 union all
 select 'reason:'||r.id,case when r.reason='payment_claim' and not chat_uses_phantom_workflow(t)
   then 'payment_claim' else 'handoff' end,l.brand_id,l.id,r.created_at
 from chat_task_reasons r join chat_task_records tr on tr.tenant_id=t and tr.id=r.record_id
 join leads l on l.tenant_id=t and l.id=tr.lead_id
 left join chat_turns turn on turn.tenant_id=t and turn.trigger_message_id=r.message_id
 where r.tenant_id=t and r.created_at>=since
  and (r.reason<>'staff_requested' or not coalesce(turn.decision_json @> '{"automatic":true,"handoff":true,"staffAlert":false}',false))
  and (not chat_uses_phantom_workflow(t) or turn.decision_json->>'reason' is distinct from 'unavailable_or_unsafe')
  and (not chat_uses_phantom_workflow(t) or not exists(
    select 1 from chat_task_reasons earlier
    left join chat_turns earlier_turn on earlier_turn.tenant_id=t and earlier_turn.trigger_message_id=earlier.message_id
    where earlier.tenant_id=t and earlier.record_id=r.record_id and earlier.reason=r.reason
      and (earlier.created_at,earlier.id)<(r.created_at,r.id)
      and (earlier.reason<>'staff_requested' or not coalesce(earlier_turn.decision_json @> '{"automatic":true,"handoff":true,"staffAlert":false}',false))
      and earlier_turn.decision_json->>'reason' is distinct from 'unavailable_or_unsafe'
      and lower(earlier_turn.decision_json#>>'{phantomRequest,deadline}')
        is not distinct from lower(turn.decision_json#>>'{phantomRequest,deadline}')
  ))
 union all
 select 'lead:'||l.id,'new_lead',l.brand_id,l.id,l.created_at
 from leads l where l.tenant_id=t and l.created_at>=since and l.first_customer_at>=since
  and not chat_uses_phantom_workflow(t)
 union all
 select 'turn:'||r.id,'agent_failure',c.brand_id,lead.id,coalesce(ar.updated_at,r.created_at) from chat_turns r
 join chat_conversations v on v.tenant_id=t and v.id=r.conversation_id join chat_channels c on c.tenant_id=t and c.id=v.channel_id
 left join chat_agent_runs ar on ar.tenant_id=t and ar.turn_id=r.id
 left join lateral(select id from leads where tenant_id=t and conversation_id=v.id and first_customer_at<=r.created_at order by first_customer_at desc,id limit 1) lead on true
 where r.tenant_id=t and (r.outcome='error' or r.decision_json->>'reason'='unavailable_or_unsafe' or ar.status='uncertain'
   or (chat_uses_phantom_workflow(t) and r.decision_json->>'reason'='model_result_unconfirmed'))
  and (chat_uses_phantom_workflow(t) or not (r.decision_json @> '{"automatic":true}' and r.decision_json ? 'staffAlert'
    and r.decision_json @> '{"reason":"unavailable_or_unsafe"}'))
  and coalesce(ar.updated_at,r.created_at)>=since;
$$;

-- Read fresh context only for the claimed delivery and its confirmed private destination.
-- The existing dispatch command still reauthorizes the claim immediately before sending.
create function public.chat_phantom_notification_context(t uuid,delivery uuid,token uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 item chat_notification_outbox%rowtype; lead_row leads%rowtype; moment timestamptz;
 evidence chat_messages%rowtype; decision jsonb; reason text; customer text;
begin
 if not chat_uses_phantom_workflow(t) then return null; end if;
 select o.* into item from chat_notification_outbox o
 join chat_notification_targets target on target.tenant_id=t and target.id=o.target_id
  and target.recipient_kind='private' and target.is_active and target.confirmed_at is not null
  and target.version=o.target_version
 where o.tenant_id=t and o.id=delivery and o.claim_token=token and o.state='sending';
 if not found then return null; end if;

 if item.kind='daily_summary' then
   return (select coalesce(jsonb_agg(to_jsonb(work) order by work.priority,work."lastCustomerAt"),'[]'::jsonb)
    from (
      select l.id as "leadId", c.display_name as customer,
        case when pending.open then 'staff' else 'reply' end as action,
        l.last_customer_at as "lastCustomerAt",
        latest.brief as request,
        case when latest.brief->>'deadline' is not null then 0 when pending.open then 1 else 2 end as priority
      from leads l
      join chat_contacts c on c.tenant_id=t and c.id=l.contact_id and c.deleted_at is null
      cross join lateral (select exists(
        select 1 from chat_task_records rec join tasks task on task.tenant_id=t and task.id=rec.task_id
        where rec.tenant_id=t and rec.lead_id=l.id and rec.closed_at is null
          and task.deleted_at is null and task.status not in ('COMPLETED','CANCELLED')
      ) as open) pending
      left join lateral (
        select turn.decision_json->'phantomRequest' as brief from chat_turns turn
        join chat_messages m on m.tenant_id=t and m.id=turn.trigger_message_id
        where turn.tenant_id=t and turn.conversation_id=l.conversation_id
          and m.created_at>=l.first_customer_at and turn.decision_json ? 'phantomRequest'
        order by m.created_at desc,m.chatwoot_message_id desc limit 1
      ) latest on pending.open
      where l.tenant_id=t and l.closed_at is null and l.kind<>'spam'
        and (pending.open or l.last_customer_at>coalesce(l.last_reply_at,'-infinity'))
        and exists(select 1 from jsonb_array_elements(item.payload_json->'brands') brand where brand->>'id'=l.brand_id::text)
      order by priority,l.last_customer_at,l.id limit 5
    ) work);
 end if;

 if item.lead_id is null then return null; end if;
 select * into lead_row from leads where tenant_id=t and id=item.lead_id;
 if not found then return null; end if;
 select display_name into customer from chat_contacts where tenant_id=t and id=lead_row.contact_id and deleted_at is null;

 if item.source_key like 'reason:%' then
   select r.reason,r.created_at into reason,moment
   from chat_task_reasons r join chat_task_records tr on tr.tenant_id=t and tr.id=r.record_id and tr.lead_id=lead_row.id
   where r.tenant_id=t and r.id=split_part(item.source_key,':',2)::uuid;
   select m.* into evidence from chat_task_reasons r join chat_messages m
     on m.tenant_id=t and m.id=r.message_id and m.conversation_id=lead_row.conversation_id
     and m.author='customer' and not m.private
   where r.tenant_id=t and r.id=split_part(item.source_key,':',2)::uuid and moment is not null;
 elsif item.source_key like 'turn:%' then
   select m.* into evidence from chat_turns turn join chat_messages m
     on m.tenant_id=t and m.id=turn.trigger_message_id and m.author='customer' and not m.private
   where turn.tenant_id=t and turn.conversation_id=lead_row.conversation_id and turn.id=split_part(item.source_key,':',2)::uuid;
 else
   select * into evidence from chat_messages where tenant_id=t and conversation_id=lead_row.conversation_id
     and author='customer' and not private and created_at between lead_row.first_customer_at and item.created_at
     order by created_at desc,chatwoot_message_id desc limit 1;
 end if;
 select decision_json into decision from chat_turns where tenant_id=t and conversation_id=lead_row.conversation_id
   and trigger_message_id=evidence.id;
 return jsonb_build_object('customer',customer,'at',coalesce(evidence.created_at,moment,item.created_at),
   'reason',reason,'request',decision->'phantomRequest',
   'failure',coalesce(decision->>'reason'='unavailable_or_unsafe',false),
   'photo',coalesce(evidence.attachments_json @> '[{"file_type":"image"}]',false),
   'excerpt',case when item.kind='payment_claim' or reason in ('dues','payment_claim') then null else left(evidence.content,360) end);
end $$;
revoke all on function public.chat_phantom_notification_context(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.chat_phantom_notification_context(uuid,uuid,uuid) to service_role;

commit;
