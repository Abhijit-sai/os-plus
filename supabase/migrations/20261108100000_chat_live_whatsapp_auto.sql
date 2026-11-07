begin;

-- Match the same explicitly scoped WhatsApp channel that already runs live drafts.
create function public.chat_live_auto_allowed(
  p_tenant uuid, p_channel uuid, p_conversation uuid, p_trigger uuid, p_pack uuid default null
) returns boolean
language sql stable set search_path=public,pg_temp as $$
  select exists (
    select 1
    from tenant_modules module
    join chat_channels channel on channel.tenant_id=module.tenant_id
      and channel.id::text=module.config_json->>'uncappedDraftChannelId'
    join chat_channel_action_approvals approval on approval.tenant_id=channel.tenant_id
      and approval.channel_id=channel.id
    join tenant_users owner on owner.tenant_id=channel.tenant_id
      and owner.id=approval.approved_by and owner.role='owner_admin' and owner.status='active'
    join chat_knowledge_packs pack on pack.tenant_id=channel.tenant_id
      and pack.id=approval.pack_id and pack.brand_id=channel.brand_id and pack.status='published'
    join chat_messages message on message.tenant_id=channel.tenant_id
      and message.conversation_id=p_conversation and message.id=p_trigger
    join chat_conversations conversation on conversation.tenant_id=channel.tenant_id
      and conversation.id=message.conversation_id and conversation.channel_id=channel.id
    where module.tenant_id=p_tenant and module.module_key='chat_leads' and module.is_enabled
      and module.config_json->>'agentEnabled'='true'
      and channel.id=p_channel and channel.kind='whatsapp' and channel.agent_mode='auto'
      and channel.is_active and not channel.can_book
      and message.author='customer' and not message.private
      and message.created_at >= approval.approved_at
      and (p_pack is null or pack.id=p_pack)
  );
$$;
revoke all on function public.chat_live_auto_allowed(uuid,uuid,uuid,uuid,uuid)
  from public,anon,authenticated,service_role;

create or replace function public.chat_live_agent_run(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t uuid := (p_context->>'tenantId')::uuid;
  loaded jsonb;
  result jsonb;
  cap numeric;
  automatic boolean;
  run chat_agent_runs;
  lead leads;
begin
  if p_context#>>'{actor,type}' is distinct from 'WEBHOOK'
    or p_context#>>'{actor,id}' is distinct from 'chatwoot'
    or p_context->>'source' is distinct from 'WEBHOOK'
    or nullif(btrim(p_context->>'correlationId'),'') is null
    or jsonb_typeof(p_input) is distinct from 'object'
  then raise exception 'Live assistance unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
  if p_action not in ('budget.settle','delivery.record','delivery.uncertain') then
    loaded := chat_agent_load(p_context,jsonb_build_object(
      'workspaceId',p_input->'workspaceId','secretHash',p_input->'secretHash',
      'channelId',p_input->'channelId','conversationId',p_input->'conversationId',
      'triggerMessageId',p_input->'triggerMessageId'
    ));
    automatic := loaded->>'agentMode'='auto';
    if automatic and loaded->>'channelKind' is distinct from 'whatsapp'
    then raise exception 'Live automatic replies require WhatsApp'; end if;
    if automatic and not chat_live_auto_allowed(
      t,(loaded->>'channelId')::uuid,(loaded->>'conversationId')::uuid,(loaded->>'triggerMessageId')::uuid
    ) then
      if p_action='budget.reserve' then return jsonb_build_object('admitted',false,'reason','auto_unapproved'); end if;
      return jsonb_build_object('status','auto_unapproved');
    end if;
    if coalesce(loaded->>'agentMode','') not in ('draft','auto') or exists (
      select 1 from chat_channels where tenant_id=t and id=(loaded->>'channelId')::uuid and can_book
    ) then raise exception 'Live assistance unavailable'; end if;
    if p_action in ('claim','budget.reserve') then
      select monthly_budget_usd into cap from chat_settings where tenant_id=t for update;
      if not found or (
        cap is null and not exists (
          select 1 from tenant_modules module
          where module.tenant_id=t and module.module_key='chat_leads' and module.is_enabled
            and module.config_json->>'uncappedDraftChannelId'=loaded->>'channelId'
            and loaded->>'channelKind'='whatsapp'
        )
      ) or (cap is not null and cap::text !~ '^(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?$') then
        if p_action='claim' then return jsonb_build_object('status','budget_unconfigured'); end if;
        return jsonb_build_object('admitted',false,'reason','budget_unconfigured');
      end if;
      if automatic and cap=0 then
        if p_action='claim' then return jsonb_build_object('status','budget_paused'); end if;
        return jsonb_build_object('admitted',false,'reason','budget_paused');
      end if;
    end if;
  end if;

  result := chat_agent_run(p_context,p_action,p_input);
  if p_action is distinct from 'complete' then return result; end if;
  if automatic and result->>'status'='cost_pending' and p_input#>>'{result,decision,handoff}'='true' then
    -- Preserve the unresolved reservation for accounting. The failed turn has no sendable answer.
    update chat_agent_runs set status='finished',updated_at=now()
    where tenant_id=t and id=(p_input->>'runId')::uuid
      and lease_token=(p_input->>'leaseToken')::uuid and status='running'
    returning * into run;
    if found then
      update chat_turns set outcome='handoff',reply_text=null,
        decision_json='{"reason":"model_result_unconfirmed","handoff":true}'
      where tenant_id=t and id=run.turn_id;
      result := jsonb_build_object('status','finished');
    end if;
  elsif automatic and result->>'status' in ('ready','finished') then
    select * into run from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
      and lease_token=(p_input->>'leaseToken')::uuid and result_json#>>'{decision,handoff}'='true';
  end if;
  if run.id is not null then
    select * into lead from leads where tenant_id=t and conversation_id=run.conversation_id and closed_at is null;
    if found then
      perform chat_handoff_upsert(p_context||jsonb_build_object('idempotencyKey','live-handoff:'||run.id),
        lead.id,run.trigger_message_id,'staff_requested',null);
    end if;
  end if;
  return result;
end;
$$;

create function public.chat_live_public_reply(p_context jsonb,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t uuid := (p_context->>'tenantId')::uuid;
  run chat_agent_runs;
  order_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
  if p_action in ('claim','target') then
    select * into run from chat_agent_runs where tenant_id=t and id=(p_input->>'runId')::uuid
      and lease_token=(p_input->>'leaseToken')::uuid;
    if not found or run.result_json#>>'{decision,automatic}' is distinct from 'true'
      or not chat_live_auto_allowed(t,run.channel_id,run.conversation_id,run.trigger_message_id,run.pack_id)
      or exists (select 1 from chat_settings where tenant_id=t and monthly_budget_usd=0)
    then return jsonb_build_object('status','auto_unapproved'); end if;
    order_status := run.result_json#>>'{decision,verifiedOrderStatus}';
    if order_status is not null and order_status is distinct from chat_live_auto_order_status(
      p_context,p_input-array['runId','leaseToken','providerMessageId']
    ) then return jsonb_build_object('status','order_changed'); end if;
  end if;
  return chat_public_reply(p_context,p_action,p_input-'verifiedPhone');
end;
$$;
revoke all on function public.chat_live_public_reply(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_live_public_reply(jsonb,text,jsonb) to service_role;

-- Return a single status only after the incoming WhatsApp identity matches the order customer.
create function public.chat_live_auto_order_status(p_context jsonb,p_input jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t uuid := (p_context->>'tenantId')::uuid;
  loaded jsonb;
  reference text;
  status text;
begin
  if coalesce(p_input->>'verifiedPhone','') !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  loaded := chat_agent_load(p_context,p_input-'verifiedPhone');
  if not chat_live_auto_allowed(t,(loaded->>'channelId')::uuid,
    (loaded->>'conversationId')::uuid,(loaded->>'triggerMessageId')::uuid) then return null; end if;

  select min(upper(found.parts[1])) into reference
  from chat_messages message
  cross join lateral regexp_matches(message.content,'\m(ORD-[0-9]{6,12})\M','gi') as found(parts)
  where message.tenant_id=t and message.conversation_id=(loaded->>'conversationId')::uuid
    and message.id=(loaded->>'triggerMessageId')::uuid
  group by message.id
  having count(*)=1;

  select orders.order_status::text into status
  from chat_conversations conversation
  join chat_contacts contact on contact.tenant_id=conversation.tenant_id
    and contact.id=conversation.contact_id and contact.merged_into is null and contact.deleted_at is null
  join customers customer on customer.tenant_id=contact.tenant_id
    and customer.id=contact.customer_id and customer.deleted_at is null
  join chat_contact_identities native on native.tenant_id=contact.tenant_id
    and native.contact_id=contact.id and native.kind='chatwoot_contact' and native.verified
    and native.value=(loaded->>'workspaceId')||':'||conversation.chatwoot_contact_id
  join chat_contact_identities phone on phone.tenant_id=contact.tenant_id
    and phone.contact_id=contact.id and phone.kind='phone' and phone.verified
    and phone.value=customer.normalized_phone_e164 and phone.value=p_input->>'verifiedPhone'
  join local_operational_orders orders on orders.tenant_id=customer.tenant_id and orders.customer_id=customer.id
    and lower(orders.order_number)=lower(reference) and orders.deleted_at is null
    and orders.order_status::text <> 'draft'
  where conversation.tenant_id=t and conversation.id=(loaded->>'conversationId')::uuid
    and not exists (
      select 1 from chat_identity_conflicts conflict where conflict.tenant_id=t
        and (conflict.contact_id=contact.id or conflict.candidate_contact_id=contact.id)
    );
  return status;
end;
$$;
revoke all on function public.chat_live_auto_order_status(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_live_auto_order_status(jsonb,jsonb) to service_role;
commit;
