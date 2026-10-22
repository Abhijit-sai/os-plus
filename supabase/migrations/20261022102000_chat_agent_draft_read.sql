-- CH-5 richer draft DTO; reuse the existing independent CRM role/tenant checks.
begin;
create function public.chat_agent_draft_read(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(p_context->>'tenantId')::uuid;record jsonb;turn chat_turns;sources jsonb;
begin
 if jsonb_typeof(p_input) is distinct from 'object' or p_input-array['id']<>'{}'::jsonb or p_input->>'id' is null
 then raise exception 'Draft unavailable';end if;
 record:=chat_crm_read(p_context,'lead',p_input);
 if record->'item'='null'::jsonb or record#>>'{permissions,pii}' is distinct from 'true' then return null;end if;
 select * into turn from chat_turns where tenant_id=t and conversation_id=(record#>>'{item,conversation_id}')::uuid
  and mode='draft' and outcome in ('drafted','handoff','fallback') and reply_text is not null order by created_at desc,id desc limit 1;
 if not found then return null;end if;
 select coalesce(jsonb_agg(x.reference),'[]'::jsonb) into sources from (
  select distinct entry->>'reference' reference from jsonb_array_elements(case when jsonb_typeof(turn.decision_json->'sources')='array' then turn.decision_json->'sources' else '[]'::jsonb end) entry
  where entry->>'kind'='knowledge' and entry->>'reference' ~ '^(hours|about|service:[a-z][a-z0-9_]{0,63}|policy:[0-9]{1,3}|price:[0-9]{1,3})$'
   and entry->>'version'=turn.knowledge_pack_version::text order by reference limit 100) x;
 return jsonb_build_object('text',turn.reply_text,'knowledgeVersion',turn.knowledge_pack_version,'sourceRefs',sources,
  'dryRun',coalesce(turn.decision_json->>'dryRun'='true',false),'mock',coalesce(turn.decision_json->>'mock'='true',false),
  'privateNoteStatus',case turn.decision_json->>'delivery' when 'pending' then 'pending' when 'posted_private_note' then 'posted' when 'uncertain' then 'uncertain' else 'none' end,
  'createdAt',turn.created_at);
end $$;
revoke all on function public.chat_agent_draft_read(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_agent_draft_read(jsonb,jsonb) to service_role;
commit;
