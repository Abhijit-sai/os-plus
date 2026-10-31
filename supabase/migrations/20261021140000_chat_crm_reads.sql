-- CH-4: service-only, tenant/role checked read boundary. No existing business writes.
begin;
create index leads_inbox_page on public.leads(tenant_id,last_customer_at desc,id desc);
create index chat_contacts_recent on public.chat_contacts(tenant_id,last_seen_at desc,id desc);
create function public.chat_report_after_hours(at_time timestamptz,pack jsonb) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare schedule jsonb:=pack#>'{crm,reportingSchedule}'; zone text; local_time timestamp; weekday integer; minute integer; w jsonb; inside boolean:=false; d integer; a integer; b integer;
begin
 if schedule is null or jsonb_typeof(schedule) is distinct from 'object' then return null; end if;
 zone:=schedule->>'timezone';
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then return null; end if;
 if jsonb_typeof(schedule->'intervals') is distinct from 'array' then return null; end if;
 if jsonb_array_length(schedule->'intervals') not between 1 and 56 then return null; end if;
 local_time:=at_time at time zone zone;
 weekday:=extract(isodow from local_time)::integer; minute:=extract(hour from local_time)::integer*60+extract(minute from local_time)::integer;
 for w in select value from jsonb_array_elements(schedule->'intervals') loop
  if coalesce(w->>'day','') !~ '^[1-7]$' or coalesce(w->>'startMinute','') !~ '^[0-9]{1,4}$' or coalesce(w->>'endMinute','') !~ '^[0-9]{1,4}$' then return null; end if;
  d:=(w->>'day')::integer;a:=(w->>'startMinute')::integer;b:=(w->>'endMinute')::integer;
  if a<0 or a>=1440 or b<=a or b>1440 then return null; end if;
  if d=weekday and minute>=a and minute<b then inside:=true; end if;
 end loop;
 return not inside;
end $$;
revoke all on function public.chat_report_after_hours(timestamptz,jsonb) from public,anon,authenticated,service_role;
create function public.chat_crm_read(p_context jsonb,p_view text,p_input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 t uuid:=(p_context->>'tenantId')::uuid; r text; pii boolean; manage boolean;
 page_number integer:=coalesce((p_input->>'page')::integer,1);
 result jsonb; target uuid; selected leads; person chat_contacts;
begin
 if p_context#>>'{actor,type}' is distinct from 'USER' or p_context->>'source' is distinct from 'OS_PLUS_UI'
 or nullif(btrim(p_context->>'correlationId'),'') is null
 or jsonb_typeof(p_input) is distinct from 'object'
 or p_input-array['page','id','brandId','locationId','channelId','stage','ownerId','state','q','contactId','segment','accountId','inboxId','conversationId'] <> '{}'::jsonb
 or page_number<1 or page_number>20000 or length(coalesce(p_input->>'q',''))>100
 then raise exception 'CRM access unavailable'; end if;
 perform 1 from tenants where id=t and status='active';
 if not found then raise exception 'CRM access unavailable'; end if;
 perform 1 from tenant_modules where tenant_id=t and module_key='chat_leads' and is_enabled;
 if not found then raise exception 'CRM access unavailable'; end if;
 select role into r from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and status='active';
 if r is null or (r not in ('owner_admin','manager') and not exists(select 1 from chat_role_permissions where tenant_id=t and role=r and permission='leads:view' and allowed))
 then raise exception 'CRM access unavailable'; end if;
 manage:=r in ('owner_admin','manager');
 pii:=manage or exists(select 1 from chat_role_permissions where tenant_id=t and role=r and permission='leads:pii' and allowed);
 if p_view='performance' and r<>'owner_admin' then raise exception 'CRM access unavailable'; end if;
 if p_view not in ('leads','lead','contacts','contact','performance','panel') then raise exception 'Unknown CRM view'; end if;
 if p_view='panel' then
  if not manage or p_input-array['accountId','inboxId','conversationId']<>'{}'::jsonb
   or coalesce((p_input->>'accountId')::bigint,0)<1 or coalesce((p_input->>'inboxId')::bigint,0)<1 or coalesce((p_input->>'conversationId')::bigint,0)<1
   then raise exception 'CRM access unavailable'; end if;
  select l.id into target from leads l
  join chat_conversations c on c.tenant_id=l.tenant_id and c.id=l.conversation_id
  join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
  join chat_workspaces w on w.tenant_id=ch.tenant_id and w.id=ch.workspace_id
  where l.tenant_id=t and w.status='active' and ch.is_active
   and w.chatwoot_account_id=(p_input->>'accountId')::bigint
   and ch.chatwoot_inbox_id=(p_input->>'inboxId')::bigint
   and c.chatwoot_conversation_id=(p_input->>'conversationId')::bigint
  order by (l.closed_at is null) desc,l.first_customer_at desc,l.id desc limit 1;
  return jsonb_build_object('leadId',target);
 end if;
 if p_view in ('contacts','contact') then
  if p_input?'segment' and p_input->>'segment' not in ('linked','unlinked','merged') then raise exception 'Invalid contact filter'; end if;
  if p_view='contact' then
   target:=(p_input->>'id')::uuid;
   select * into person from chat_contacts where tenant_id=t and id=target and deleted_at is null;
   if not found then return jsonb_build_object('item',null); end if;
  end if;
  with matched as (
   select c.* from chat_contacts c where c.tenant_id=t and c.deleted_at is null
    and (p_view<>'contact' or c.id=target)
    and (p_view='contact' or (coalesce(p_input->>'segment','')='merged' and c.merged_into is not null) or (coalesce(p_input->>'segment','')<>'merged' and c.merged_into is null))
    and (coalesce(p_input->>'segment','')<>'linked' or c.customer_id is not null)
    and (coalesce(p_input->>'segment','')<>'unlinked' or c.customer_id is null)
    and (coalesce(p_input->>'q','')='' or (pii and (position(lower(p_input->>'q') in lower(coalesce(c.display_name,'')))>0
     or exists(select 1 from chat_contact_identities i where i.tenant_id=t and i.contact_id=c.id and i.kind='phone' and position(p_input->>'q' in i.value)>0))))
  ), paged as (select * from matched order by last_seen_at desc,id desc limit 50 offset (page_number-1)*50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'display_name',case when pii then c.display_name else null end,'customer_id',case when pii then c.customer_id else null end,'linked',c.customer_id is not null,
   'merged_into',case when pii then c.merged_into else null end,'merged',c.merged_into is not null,'first_seen_at',c.first_seen_at,'last_seen_at',c.last_seen_at,'version',c.version,'notes',case when pii then c.notes else null end,
   'identities',case when pii then coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'value',i.value,'verified',i.verified) order by i.kind,i.id) from chat_contact_identities i where i.tenant_id=t and i.contact_id=c.id),'[]'::jsonb) else '[]'::jsonb end
  ) order by c.last_seen_at desc,c.id desc) from paged c),'[]'::jsonb),
   'total',(select count(*) from matched),'linked',(select count(*) from matched where customer_id is not null),
   'page',page_number,'permissions',jsonb_build_object('pii',pii,'manage',manage,'reports',r='owner_admin'),'asOf',now()) into result;
  if p_view='contacts' then return result; end if;
  return result || jsonb_build_object('item',result#>'{items,0}','details',jsonb_build_object(
   'identities',case when pii then coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'value',i.value,'verified',i.verified) order by i.kind,i.id) from chat_contact_identities i where i.tenant_id=t and i.contact_id=target),'[]'::jsonb) else '[]'::jsonb end,
   'customer',case when manage then (select jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'email',c.email) from customers c where c.tenant_id=t and c.id=person.customer_id and c.deleted_at is null) else null end,
   'matchingCustomers',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name))
     from customers c join chat_contact_identities i on i.tenant_id=c.tenant_id and i.kind='phone' and i.verified and i.value=c.normalized_phone_e164
     where c.tenant_id=t and c.deleted_at is null and i.contact_id=target),'[]'::jsonb) else '[]'::jsonb end,
   'orders',case when manage then coalesce((select jsonb_agg(x order by x.order_date desc,x.id desc) from (
     select o.id,o.order_number,o.order_date,o.order_status::text status,o.total_amount total,o.amount_paid paid,o.source_currency_code currency
     from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled') order by o.order_date desc,o.id desc limit 20) x),'[]'::jsonb) else '[]'::jsonb end,
   'orderCount',case when manage then (select count(*) from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled')) else 0 end,
   'lifetime',case when manage then coalesce((select jsonb_agg(x) from (select o.source_currency_code currency,sum(o.total_amount) amount from orders o where o.tenant_id=t and o.customer_id=person.customer_id and o.deleted_at is null and o.order_status not in ('draft','cancelled') group by o.source_currency_code order by o.source_currency_code) x),'[]'::jsonb) else '[]'::jsonb end,
   'merges',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'at',m.created_at,'splitAt',m.split_at) order by m.created_at desc,m.id desc) from (select * from chat_contact_merges where tenant_id=t and (from_contact_id=target or to_contact_id=target) order by created_at desc,id desc limit 20) m),'[]'::jsonb) else '[]'::jsonb end,
   'language',case when pii and length(person.prefs_json->>'language') between 2 and 35 then person.prefs_json->>'language' else null end
  ));
 end if;
 if p_input?'stage' and p_input->>'stage' not in ('new','engaged','booked','in_progress','won','lost')
 or p_input?'state' and p_input->>'state' not in ('waiting','hot','unassigned','handoff','needs_look')
 then raise exception 'Invalid CRM filter'; end if;
 if p_view='lead' then
  target:=(p_input->>'id')::uuid;
  select * into selected from leads where tenant_id=t and id=target;
  if not found then return jsonb_build_object('item',null); end if;
 end if;
 with filtered as (
  select l.*,
   case when pii then c.display_name else null end display_name,
   b.name brand_name, ch.name channel_name,
   (l.closed_at is null and (l.last_reply_at is null or l.last_reply_at<l.last_customer_at)) waiting,
   (l.closed_at is null and l.kind='sales' and l.intent is not null and l.last_customer_at<=now()
    and l.last_customer_at>now()-make_interval(hours=>s.hot_hours)
    and coalesce(k.pack_json#>'{crm,hotIntents}','[]'::jsonb)?l.intent) hot
  from leads l
  join chat_contacts c on c.tenant_id=l.tenant_id and c.id=l.contact_id
  join chat_brands b on b.tenant_id=l.tenant_id and b.id=l.brand_id
  join chat_channels ch on ch.tenant_id=l.tenant_id and ch.id=l.channel_id
  join chat_settings s on s.tenant_id=l.tenant_id
  left join chat_knowledge_packs k on k.tenant_id=l.tenant_id and k.brand_id=l.brand_id and k.status='published'
  where l.tenant_id=t and (p_view<>'lead' or l.id=target)
   and (not(p_input?'brandId') or l.brand_id=(p_input->>'brandId')::uuid)
   and (not(p_input?'locationId') or l.location_id=(p_input->>'locationId')::uuid)
   and (not(p_input?'channelId') or l.channel_id=(p_input->>'channelId')::uuid)
   and (not(p_input?'contactId') or l.contact_id=(p_input->>'contactId')::uuid)
   and (not(p_input?'stage') or l.stage=p_input->>'stage')
   and (not(p_input?'ownerId') or l.owner_tenant_user_id=(p_input->>'ownerId')::uuid)
   and (not(p_input?'q') or l.ref_code ilike '%'||(p_input->>'q')||'%' or (pii and c.display_name ilike '%'||(p_input->>'q')||'%'))
 ), scoped as (
  select * from filtered f where not(p_input?'state')
   or (p_input->>'state'='needs_look' and f.closed_at is null and (f.waiting or f.handoff or f.owner_tenant_user_id is null))
   or (p_input->>'state'='waiting' and f.waiting)
   or (p_input->>'state'='hot' and f.hot)
   or (p_input->>'state'='unassigned' and f.closed_at is null and f.owner_tenant_user_id is null)
   or (p_input->>'state'='handoff' and f.handoff and f.closed_at is null)
 ), reply_facts as (
  select m.*,s.tenant_user_id,chat_report_after_hours(m.created_at,k.pack_json) after_hours from chat_messages m
  join chat_conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
  join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
  left join chat_knowledge_packs k on k.tenant_id=ch.tenant_id and k.brand_id=ch.brand_id and k.status='published'
  left join chat_staff_links s on s.tenant_id=m.tenant_id and s.chatwoot_user_id=m.staff_chatwoot_user_id
  where m.tenant_id=t and m.author='staff' and not m.private
   and m.conversation_id in (select conversation_id from scoped)
 ), people as (
  select u.id,coalesce(u.display_name,'Team member') name,u.status::text status,
   (select count(*) from reply_facts f where f.tenant_user_id=u.id) replies,
   (select count(*) from scoped l where l.owner_tenant_user_id=u.id and l.closed_at is null) owned,
   (select count(*) from scoped l where l.owner_tenant_user_id=u.id and l.stage='won') won,
   case when not exists(select 1 from reply_facts f where f.tenant_user_id=u.id) or exists(select 1 from reply_facts f where f.tenant_user_id=u.id and f.after_hours is null) then null else (select count(*) from reply_facts f where f.tenant_user_id=u.id and f.after_hours) end "afterHours"
  from tenant_users u where u.tenant_id=t and (u.role in ('owner_admin','manager') or exists(select 1 from chat_staff_links s where s.tenant_id=t and s.tenant_user_id=u.id))
 ), people_page as (
  select * from people order by name,id limit 50 offset (page_number-1)*50
 ), paged as (
  select * from scoped order by last_customer_at desc,id desc limit 50 offset (page_number-1)*50
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg((to_jsonb(p)-array['tenant_id','created_by','updated_by']) ||
    case when pii then '{}'::jsonb else jsonb_build_object('notes',null,'gist',null,'area',null,'services','[]'::jsonb,'customer_id',null,'display_name',null) end
    order by p.last_customer_at desc,p.id desc) from paged p),'[]'::jsonb),
  'total',(select count(*) from scoped),
  'counters',(select jsonb_build_object('open',count(*) filter(where closed_at is null),'awaitingFirstReply',count(*) filter(where closed_at is null and first_response_at is null),'waiting',count(*) filter(where waiting),'hot',count(*) filter(where hot),'unassigned',count(*) filter(where closed_at is null and owner_tenant_user_id is null),'handoff',count(*) filter(where closed_at is null and handoff)) from scoped),
  'pipeline',coalesce((select jsonb_agg(x) from (select currency,sum(est_value) amount,count(*) known from scoped where closed_at is null and kind='sales' and est_value is not null group by currency order by currency) x),'[]'::jsonb),
  'performance',case when p_view='performance' then jsonb_build_object(
   'medianFirstHumanSeconds',(select percentile_cont(0.5) within group(order by greatest(0,extract(epoch from first_human_response_at-first_customer_at))) from scoped where first_human_response_at is not null),
   'publicStaffReplies',(select count(*) from reply_facts),
   'unmappedStaffReplies',(select count(*) from reply_facts where tenant_user_id is null),
   'afterHoursUnknownReplies',(select count(*) from reply_facts where after_hours is null),
   'people',coalesce((select jsonb_agg(p order by p.name,p.id) from people_page p),'[]'::jsonb),
   'peopleCount',(select count(*) from people),
   'needsLook',coalesce((select jsonb_agg(to_jsonb(n)-array['tenant_id','created_by','updated_by'] order by n.last_customer_at,n.id) from (select * from scoped where closed_at is null and (waiting or handoff or owner_tenant_user_id is null) order by last_customer_at,id limit 20) n),'[]'::jsonb),
   'needsLookCount',(select count(*) from scoped where closed_at is null and (waiting or handoff or owner_tenant_user_id is null))
  ) else null end,
  'permissions',jsonb_build_object('pii',pii,'manage',manage,'reports',r='owner_admin'),
  'page',page_number,'asOf',now()
 ) into result;
 if p_view='lead' then
  return result || jsonb_build_object('item',result#>'{items,0}','details',jsonb_build_object(
   'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'author',m.author,'private',false,'content',case when pii then m.content else null end,'created_at',m.created_at) order by m.created_at,m.id)
    from (select * from chat_messages where tenant_id=t and conversation_id=selected.conversation_id and not private and author in ('customer','staff','bot') order by created_at desc,id desc limit 50) m),'[]'::jsonb),
   'messageCount',(select count(*) from chat_messages where tenant_id=t and conversation_id=selected.conversation_id and not private and author in ('customer','staff','bot')),
   'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'at',e.at,'actor_type',e.actor_type) order by e.at desc,e.id desc)
    from (select * from lead_events where tenant_id=t and lead_id=target order by at desc,id desc limit 50) e),'[]'::jsonb),
   'historyCount',(select count(*) from lead_events where tenant_id=t and lead_id=target),
   'chat',case when manage then (select jsonb_build_object('baseUrl',w.chatwoot_base_url,'accountId',w.chatwoot_account_id,'conversationId',c.chatwoot_conversation_id)
    from chat_conversations c join chat_channels ch on ch.tenant_id=c.tenant_id and ch.id=c.channel_id
    join chat_workspaces w on w.tenant_id=ch.tenant_id and w.id=ch.workspace_id
    where c.tenant_id=t and c.id=selected.conversation_id and w.status='active') else null end,
   'owners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(u.display_name,'Team member')) order by u.display_name,u.id)
    from tenant_users u where u.tenant_id=t and u.status='active' and u.role in ('owner_admin','manager')),'[]'::jsonb),
   'draft',case when pii then (select jsonb_build_object('text',reply_text,'knowledgeVersion',knowledge_pack_version)
    from chat_turns where tenant_id=t and conversation_id=selected.conversation_id and outcome='drafted' and reply_text is not null order by created_at desc,id desc limit 1) else null end
  ));
 end if;
 return result;
end $$;
revoke all on function public.chat_crm_read(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_crm_read(jsonb,text,jsonb) to service_role;
commit;

