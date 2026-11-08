begin;

-- The operation is selected by the server's fixed intent parser. Customer,
-- order and tenant are resolved from the signed, approved WhatsApp trigger.
create function public.chat_live_auto_customer_lookup(p_context jsonb,p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  t uuid := (p_context->>'tenantId')::uuid;
  sender_phone text := p_input->>'verifiedPhone';
  lookup_kind text := p_input->>'kind';
  loaded jsonb;
  matched_customer uuid;
  order_ref text;
  refs integer;
  request_text text;
  selected_order local_operational_orders%rowtype;
  status_label text;
  address_claim text;
  reply text;
begin
  if jsonb_typeof(p_input) is distinct from 'object'
    or p_input-array['workspaceId','secretHash','channelId','conversationId','triggerMessageId','verifiedPhone','kind']<>'{}'::jsonb
    or coalesce(sender_phone,'') !~ '^\+[1-9][0-9]{7,14}$'
    or coalesce(lookup_kind,'') not in ('status','tracking','balance','address','measurements')
  then return null; end if;
  loaded := chat_agent_load(p_context,p_input-array['verifiedPhone','kind']);
  if not chat_live_auto_allowed(t,(loaded->>'channelId')::uuid,
    (loaded->>'conversationId')::uuid,(loaded->>'triggerMessageId')::uuid) then return null; end if;

  select cu.id into matched_customer
  from chat_conversations conversation
  join chat_contacts contact on contact.tenant_id=conversation.tenant_id and contact.id=conversation.contact_id
    and contact.merged_into is null and contact.deleted_at is null
  join customers cu on cu.tenant_id=contact.tenant_id and cu.id=contact.customer_id
    and cu.deleted_at is null and cu.normalized_phone_e164=sender_phone
  join chat_contact_identities native on native.tenant_id=contact.tenant_id and native.contact_id=contact.id
    and native.kind='chatwoot_contact' and native.verified
    and native.value=(loaded->>'workspaceId')||':'||conversation.chatwoot_contact_id
  join chat_contact_identities phone on phone.tenant_id=contact.tenant_id and phone.contact_id=contact.id
    and phone.kind='phone' and phone.verified and phone.value=sender_phone
  where conversation.tenant_id=t and conversation.id=(loaded->>'conversationId')::uuid
    and not exists(select 1 from customers other where other.tenant_id=t
      and other.normalized_phone_e164=sender_phone and other.deleted_at is null and other.id<>cu.id)
    and not exists(select 1 from chat_identity_conflicts conflict where conflict.tenant_id=t
      and (conflict.contact_id=contact.id or conflict.candidate_contact_id=contact.id));
  if not found then return null; end if;

  select message.content into request_text from chat_messages message
  where message.tenant_id=t and message.id=(loaded->>'triggerMessageId')::uuid;
  select min(upper(found.parts[1])),count(*) into order_ref,refs
  from regexp_matches(request_text,'\m(ORD-[0-9]{6,12})\M','gi') as found(parts);
  if refs>1 or (refs>0 and lookup_kind='measurements') then return null; end if;
  if lookup_kind='tracking' and coalesce(request_text,'') !~* '\mtracking link\M'
    then return null; end if;

  if lookup_kind='measurements' then
    -- This schema records the account holding a fitting profile, but does
    -- not verify the wearer. Confirm existence only, without values or notes.
    if exists(select 1 from customer_measurements cm
      where cm.tenant_id=t and cm.customer_id=matched_customer and cm.deleted_at is null
        and cm.measurement_data_json<>'{}'::jsonb)
    then reply:='We have a saved measurement record. Our team can help confirm which fitting details apply.';
    end if;
  else
    select o.* into selected_order from local_operational_orders o
    where o.tenant_id=t and o.customer_id=matched_customer and o.deleted_at is null
      and o.order_status::text<>'draft'
      and (order_ref is null or lower(o.order_number)=lower(order_ref))
    order by o.order_date desc,o.created_at desc,o.id desc limit 1;
    if not found then return null; end if;
    if order_ref is null and selected_order.order_status::text not in ('confirmed','in_progress','ready','partially_delivered')
      then return null; end if;

    case lookup_kind
      when 'status' then
        select case when count(*)>0 and count(cs.id)=count(*) and count(distinct cs.name)=1
                    then min(cs.name) end into status_label
        from order_items oi left join customer_statuses cs on cs.tenant_id=oi.tenant_id
          and cs.id=oi.customer_status_id and cs.deleted_at is null
        where oi.tenant_id=t and oi.order_id=selected_order.id and oi.deleted_at is null and oi.is_customer_visible;
        reply:=case selected_order.order_status::text
          when 'cancelled' then 'Your order has been cancelled.'
          when 'delivered' then 'Your order has been delivered.'
          when 'partially_delivered' then 'Part of your order has been delivered.'
          else coalesce('Your order update: '||nullif(btrim(status_label),'')||'.',
            case selected_order.order_status::text
              when 'confirmed' then 'We have received your order.'
              when 'in_progress' then 'We’re working on your order.'
              when 'ready' then 'Your order is ready.'
              when 'completed' then 'Your order is ready.'
            end)
        end;
      when 'tracking' then
        if selected_order.tracking_token ~ '^[A-Za-z0-9_-]{32}$' then
          reply:='Here is your order tracking link: https://os-plus.vercel.app/track/'||selected_order.tracking_token;
        end if;
      when 'balance' then
        if selected_order.order_status::text<>'cancelled'
          and selected_order.payment_status::text in ('unpaid','partially_paid')
          and selected_order.total_amount>selected_order.amount_paid
        then reply:='There is a payment pending on your order. Our team can confirm the amount and payment options.';
        end if;
      when 'address' then
        if selected_order.delivery_type::text<>'store_pickup'
          and nullif(btrim(selected_order.delivery_address),'') is not null
        then
          address_claim:=substring(request_text from '(?i)^\s*is my (?:shipping|delivery) address (.{5,250})\?\s*$');
          reply:=case
            when address_claim is null or lower(btrim(address_claim))='on file'
              then 'We have a delivery address on file for your order.'
            when lower(btrim(address_claim))=lower(btrim(selected_order.delivery_address))
              then 'That matches the delivery address on file for your order.'
            else 'That does not match the delivery address on file. Our team can help check it.'
          end;
        end if;
    end case;
  end if;
  if reply is null then return null; end if;
  return jsonb_build_object('kind',lookup_kind,'text',reply,'proof',
    encode(sha256(convert_to(jsonb_build_array(t,matched_customer,selected_order.id,lookup_kind,reply)::text,'UTF8')),'hex'));
end;
$$;
revoke all on function public.chat_live_auto_customer_lookup(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_live_auto_customer_lookup(jsonb,jsonb) to service_role;

-- Recheck the same record and answer after any awaited preparation, including
-- at the final delivery target. The result carries a proof, not record IDs.
do $$
declare
  definition text := pg_get_functiondef('public.chat_live_public_reply(jsonb,text,jsonb)'::regprocedure);
  declaration text := $old$order_status text;$old$;
  anchor text := $old$order_status := run.result_json#>>'{decision,verifiedOrderStatus}';$old$;
  replacement text := $new$if run.result_json#>'{decision,verifiedCustomerLookup}' is not null then
      verified := chat_live_auto_customer_lookup(p_context,
        (p_input-array['runId','leaseToken','providerMessageId'])||
        jsonb_build_object('kind',run.result_json#>>'{decision,verifiedCustomerLookup,kind}'));
      if verified is null
        or verified->>'proof' is distinct from run.result_json#>>'{decision,verifiedCustomerLookup,proof}'
        or verified->>'text' is distinct from run.result_json->>'replyText'
      then return jsonb_build_object('status','customer_context_changed'); end if;
    end if;
    order_status := run.result_json#>>'{decision,verifiedOrderStatus}';$new$;
begin
  if strpos(definition,declaration)=0 or strpos(definition,anchor)=0 then
    raise exception 'Unexpected chat_live_public_reply definition';
  end if;
  execute replace(replace(definition,declaration,declaration||' verified jsonb;'),anchor,replacement);
end $$;

-- A later switch to Draft must not put a sent tracking URL or payment detail
-- from this feature into the model's conversation history.
do $$
declare
  definition text := pg_get_functiondef('public.chat_agent_load(jsonb,jsonb)'::regprocedure);
  anchor text := $old$return data||jsonb_build_object('messages',messages$old$;
  projection text := $new$if data->>'agentMode'='draft' then
  data:=data||coalesce((
   select jsonb_build_object('verifiedLookupReplyIds',jsonb_agg(distinct message->>'id'))
   from jsonb_array_elements(messages) message
   join chat_public_outbox o on o.tenant_id=t and o.conversation_id=msg.conversation_id
    and (o.provider_message_id=(message->>'providerId')::bigint
      or (message->>'author' in ('bot','staff') and o.text=message->>'content'))
   join chat_agent_runs ar on ar.tenant_id=t and ar.id=o.run_id
    and ar.result_json#>'{decision,verifiedCustomerLookup}' is not null
   having count(*)>0
  ),'{}'::jsonb);
 end if;
 return data||jsonb_build_object('messages',messages$new$;
begin
  if strpos(definition,anchor)=0 then
    raise exception 'Unexpected chat_agent_load definition';
  end if;
  execute replace(definition,anchor,projection);
end $$;

notify pgrst, 'reload schema';
commit;
