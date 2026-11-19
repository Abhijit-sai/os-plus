begin;

-- Acknowledging a digest entry affects only the attention list, until fresh activity.
create table public.chat_digest_acknowledgements (
  tenant_id uuid not null,
  lead_id uuid not null,
  through_at timestamptz not null,
  primary key (tenant_id, lead_id),
  foreign key (tenant_id, lead_id) references public.leads(tenant_id, id) on delete cascade
);
alter table public.chat_digest_acknowledgements enable row level security;
revoke all on public.chat_digest_acknowledgements from public, anon, authenticated, service_role;

-- Only an operator may queue an edit, and only against an existing delivery.
create table public.chat_digest_edits (
  tenant_id uuid not null,
  delivery_id uuid not null,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  claimed_at timestamptz,
  claim_token uuid,
  confirmed_at timestamptz,
  primary key (tenant_id, delivery_id),
  foreign key (tenant_id, delivery_id) references public.chat_notification_outbox(tenant_id,id)
);
alter table public.chat_digest_edits enable row level security;
revoke all on public.chat_digest_edits from public, anon, authenticated, service_role;

create function public.chat_phantom_items_advanced(t uuid, report jsonb) returns bigint
language sql stable set search_path=public,pg_temp as $$
  -- Production items belong to the tenant. Omit the total for a partial brand audience.
  select case when jsonb_array_length(report->'brands') > 0 and not exists (
    select 1 from chat_brands b where b.tenant_id=t and b.is_active and b.deleted_at is null
    and not exists (select 1 from jsonb_array_elements(report->'brands') scope where scope->>'id'=b.id::text)
  ) then (
    select count(distinct h.order_item_id) from item_history h
    where h.tenant_id=t and h.event_type='stage_completed'
      and h.created_at >= ((report->>'localDate')::date::timestamp at time zone (report->>'timezone'))
      and h.created_at < (report->>'windowEnd')::timestamptz
  ) end;
$$;
revoke all on function public.chat_phantom_items_advanced(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.chat_phantom_daily_summary_context(t uuid, delivery uuid, token uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare report jsonb; attention jsonb;
begin
  if not chat_uses_phantom_workflow(t) then return null; end if;
  select o.payload_json into report from chat_notification_outbox o
  join chat_notification_targets n on n.tenant_id=t and n.id=o.target_id and n.version=o.target_version
  where o.tenant_id=t and o.id=delivery and o.claim_token=token and o.state='sending'
    and o.kind='daily_summary' and n.recipient_kind='private' and n.is_active
    and n.confirmed_at is not null and o.kind=any(n.events);
  if not found then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(work) order by work.priority,work."lastCustomerAt",work."leadId"),'[]'::jsonb)
  into attention from (
    select l.id as "leadId", c.display_name as customer,
      case when pending.open then 'staff' else 'reply' end as action,
      l.last_customer_at as "lastCustomerAt", latest.brief as request,
      case when latest.brief->>'deadline' is not null then 0 when pending.open then 1 else 2 end as priority
    from leads l
    join chat_contacts c on c.tenant_id=t and c.id=l.contact_id and c.deleted_at is null
    left join chat_digest_acknowledgements ack on ack.tenant_id=t and ack.lead_id=l.id
    cross join lateral (
      select exists (
        select 1 from chat_task_records rec join tasks task on task.tenant_id=t and task.id=rec.task_id
        where rec.tenant_id=t and rec.lead_id=l.id and rec.closed_at is null
          and task.deleted_at is null and task.status not in ('COMPLETED','CANCELLED')
          and (ack.through_at is null or l.last_customer_at>ack.through_at or rec.created_at>ack.through_at
            or exists (select 1 from chat_task_reasons reason where reason.tenant_id=t and reason.record_id=rec.id and reason.created_at>ack.through_at))
      ) as open
    ) pending
    left join lateral (
      select turn.decision_json->'phantomRequest' as brief from chat_turns turn
      join chat_messages m on m.tenant_id=t and m.id=turn.trigger_message_id
      where turn.tenant_id=t and turn.conversation_id=l.conversation_id
        and m.created_at>=l.first_customer_at and turn.decision_json ? 'phantomRequest'
      order by m.created_at desc,m.chatwoot_message_id desc limit 1
    ) latest on pending.open
    where l.tenant_id=t and l.closed_at is null and l.kind<>'spam'
      and (pending.open or (l.last_customer_at>coalesce(l.last_reply_at,'-infinity')
        and l.last_customer_at>coalesce(ack.through_at,'-infinity')))
      and exists(select 1 from jsonb_array_elements(report->'brands') brand where brand->>'id'=l.brand_id::text)
    order by priority,l.last_customer_at,l.id limit 5
  ) work;
  return jsonb_build_object('itemsAdvanced',chat_phantom_items_advanced(t,report),'attention',attention);
end $$;

-- The original recipient, target version, settings and brand scope must still match.
create function public.chat_claim_digest_edit(t uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job record; token uuid:=gen_random_uuid();
begin
  if not chat_uses_phantom_workflow(t) then return null; end if;
  select e.delivery_id,e.details,o.payload_json,o.provider_message_id,n.id as target,n.recipient_enc into job
  from chat_digest_edits e
  join chat_notification_outbox o on o.tenant_id=t and o.id=e.delivery_id and o.kind='daily_summary' and o.state='sent'
  join chat_notification_targets n on n.tenant_id=t and n.id=o.target_id and n.version=o.target_version
  join chat_settings s on s.tenant_id=t and s.notifications_enabled and s.notification_version=o.settings_version
  join tenants tenant on tenant.id=t and tenant.status='active'
  join tenant_modules m on m.tenant_id=t and m.module_key='chat_leads' and m.is_enabled
  where e.tenant_id=t and e.confirmed_at is null and e.claimed_at is null
    and n.is_active and n.recipient_kind='private' and n.confirmed_at is not null and o.kind=any(n.events)
    and not exists (
      select 1 from jsonb_array_elements(o.payload_json->'brands') b
      where not exists(select 1 from chat_brands cb where cb.tenant_id=t and cb.id::text=b->>'id' and cb.is_active and cb.deleted_at is null)
      or (exists(select 1 from chat_notification_target_brands tb where tb.tenant_id=t and tb.target_id=n.id)
        and not exists(select 1 from chat_notification_target_brands tb where tb.tenant_id=t and tb.target_id=n.id and tb.brand_id::text=b->>'id'))
    )
    and (e.details->>'itemsAdvanced' is null or chat_phantom_items_advanced(t,o.payload_json) is not null)
  order by e.delivery_id limit 1 for update of e skip locked;
  if not found then return null; end if;
  update chat_digest_edits set claimed_at=clock_timestamp(), claim_token=token where tenant_id=t and delivery_id=job.delivery_id;
  return jsonb_build_object('deliveryId',job.delivery_id,'token',token,'targetId',job.target,
    'recipientEnc',job.recipient_enc,'messageId',job.provider_message_id,'payload',job.payload_json,'details',job.details);
end $$;

create function public.chat_confirm_digest_edit(t uuid, delivery uuid, token uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
  with updated as (
    update chat_digest_edits set confirmed_at=coalesce(confirmed_at,clock_timestamp())
    where tenant_id=t and delivery_id=delivery and claim_token=token returning 1
  ) select exists(select from updated);
$$;

revoke all on function public.chat_phantom_daily_summary_context(uuid,uuid,uuid), public.chat_claim_digest_edit(uuid),
  public.chat_confirm_digest_edit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.chat_phantom_daily_summary_context(uuid,uuid,uuid), public.chat_claim_digest_edit(uuid),
  public.chat_confirm_digest_edit(uuid,uuid,uuid) to service_role;
commit;
