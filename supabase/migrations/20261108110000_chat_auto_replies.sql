begin;

-- Extend the existing ledger validator without replacing the fenced run/delivery logic.
do $$
declare
  definition text := replace(pg_get_functiondef('public.chat_agent_finish(jsonb,text,jsonb,jsonb)'::regprocedure), chr(13), '');
  old_ledger text := $old$or (v->'ledger')-array['schemaVersion','sessionStartedAt','requestOpen','vendorQuietUntil','language','handoff']<>'{}'::jsonb$old$;
  new_ledger text := $new$or (v->'ledger')-array['schemaVersion','sessionStartedAt','requestOpen','vendorQuietUntil','language','handoff','automaticClarification']<>'{}'::jsonb
    or (v->'ledger' ? 'automaticClarification' and (
      jsonb_typeof(v#>'{ledger,automaticClarification}') is distinct from 'string'
      or length(btrim(v#>>'{ledger,automaticClarification}')) not between 1 and 6000
    ))$new$;
  old_cost text := $old$if exists(select 1 from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state<>'settled')$old$;
  new_cost text := $new$if exists(select 1 from chat_agent_cost_entries where tenant_id=t and run_id=r.id and state<>'settled')
  -- An approved fixed error line contains no model output. Keep the reservation
  -- held and let the regular latest-message, quiet, pack and delivery checks run.
  and not coalesce(
    p_loaded->>'agentMode'='auto'
    and v#>>'{decision,automatic}'='true'
    and v#>'{decision,staffAlert}'='true'::jsonb
    and v#>>'{decision,reason}'='unavailable_or_unsafe'
    and v#>>'{decision,handoff}'='true'
    and (
      (v->>'outcome'='fallback' and v->>'replyText'=coalesce(
        btrim(p_loaded#>>'{pack,body,replies,error}'),
        'I’ll pass this to our team. They’ll check the details and reply here.'
      ))
      or (v->>'outcome'='silent' and v->>'replyText' is null)
    ), false)$new$;
begin
  if strpos(definition,old_ledger)=0 or strpos(definition,old_cost)=0 then
    raise exception 'Unexpected chat_agent_finish definition';
  end if;
  execute replace(replace(definition,old_ledger,new_ledger),old_cost,new_cost);
end $$;

-- A confirmed send can precede its Chatwoot capture webhook.
do $$
declare
  definition text := pg_get_functiondef('public.chat_agent_load(jsonb,jsonb)'::regprocedure);
  anchor text := $old$return data||jsonb_build_object('messages',messages$old$;
  projection text := $new$if data->>'agentMode'='auto' and data->'ledger' ? 'automaticClarification' then
  data:=data||jsonb_build_object('automaticClarificationSent',exists(
   select 1 from chat_agent_runs ar join chat_public_outbox o on o.tenant_id=t and o.run_id=ar.id
   join chat_messages incoming on incoming.tenant_id=t and incoming.id=ar.trigger_message_id
   where ar.tenant_id=t and ar.conversation_id=msg.conversation_id
    and ar.result_json @> '{"decision":{"automatic":true,"reason":"clarification"}}'
    and o.state='sent' and o.text=data#>>'{ledger,automaticClarification}'
    and incoming.created_at>=(data#>>'{ledger,sessionStartedAt}')::timestamptz
  ));
 end if;
 return data||jsonb_build_object('messages',messages$new$;
begin
  if strpos(definition,anchor)=0 then
    raise exception 'Unexpected chat_agent_load definition';
  end if;
  execute replace(definition,anchor,projection);
end $$;

create or replace function public.chat_notification_sources(t uuid,since timestamptz)
returns table(source_key text,kind text,brand_id uuid,lead_id uuid,occurred_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select 'request:'||r.id,'booking_request',r.brand_id,r.lead_id,r.created_at
 from chat_action_requests r where r.tenant_id=t and r.created_at>=since
 union all
 select 'reason:'||r.id,case when r.reason='payment_claim' then 'payment_claim' else 'handoff' end,l.brand_id,l.id,r.created_at
 from chat_task_reasons r join chat_task_records tr on tr.tenant_id=t and tr.id=r.record_id
 join leads l on l.tenant_id=t and l.id=tr.lead_id
 where r.tenant_id=t and r.created_at>=since
  and (r.reason<>'staff_requested' or not exists(
   select 1 from chat_turns turn
   where turn.tenant_id=t and turn.conversation_id=l.conversation_id
    and turn.trigger_message_id=r.message_id and turn.decision_json->>'automatic'='true'
    and turn.decision_json @> '{"handoff":true,"staffAlert":false}'
  ))
 union all
 select 'lead:'||l.id,'new_lead',l.brand_id,l.id,l.created_at
 from leads l where l.tenant_id=t and l.created_at>=since and l.first_customer_at>=since
 union all
 select 'turn:'||r.id,'agent_failure',c.brand_id,lead.id,coalesce(ar.updated_at,r.created_at) from chat_turns r
 join chat_conversations v on v.tenant_id=t and v.id=r.conversation_id join chat_channels c on c.tenant_id=t and c.id=v.channel_id
 left join chat_agent_runs ar on ar.tenant_id=t and ar.turn_id=r.id
 left join lateral(select id from leads where tenant_id=t and conversation_id=v.id and first_customer_at<=r.created_at order by first_customer_at desc,id limit 1) lead on true
 where r.tenant_id=t and (r.outcome='error' or r.decision_json->>'reason'='unavailable_or_unsafe' or ar.status='uncertain')
  and not (r.decision_json @> '{"automatic":true}' and r.decision_json ? 'staffAlert'
    and r.decision_json @> '{"reason":"unavailable_or_unsafe"}')
  and coalesce(ar.updated_at,r.created_at)>=since;
$$;

commit;
