-- Commercial reads only. Operational/production, accounting and public
-- tracking views remain unchanged: an unconfigured draft is not production.
create function public.list_shopify_commercial_orders(
  p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,
  p_search text default null,p_source text default null,p_status text default null,p_payment text default null,
  p_view text default 'all',p_limit integer default 50,p_offset integer default 0
) returns setof public.orders language sql stable security definer set search_path=public,pg_temp as $$
  with eligible as (
    select o.* from public.operational_orders o where o.tenant_id=p_tenant_id
    union all
    select o.* from public.orders o where o.tenant_id=p_tenant_id and o.source='shopify' and o.order_status='draft'
      and exists(select 1 from public.shopify_source_orders s join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id
        where s.tenant_id=o.tenant_id and s.order_id=o.id and c.canonical_domain=p_domain and c.app_ref=p_app_ref and c.environment='production')
  )
  select o.* from eligible o
  left join public.customers customer on customer.tenant_id=o.tenant_id and customer.id=o.customer_id and customer.deleted_at is null
  left join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  left join lateral(select r.id from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  left join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  where o.deleted_at is null
    and exists(select 1 from public.tenants t where t.id=p_tenant_id and t.status='active')
    and exists(select 1 from public.tenant_users u where u.tenant_id=p_tenant_id and u.clerk_user_id=p_actor_id and u.status='active' and u.role in ('owner_admin','manager'))
    and (p_source is null or o.source::text=p_source)
    and (p_status is null or o.order_status::text=p_status)
    and (p_payment is null or case when o.source<>'shopify' then o.payment_status::text=p_payment else
      case d.details->'payment'->>'status' when 'PAID' then 'paid' when 'PARTIALLY_PAID' then 'partially_paid'
        when 'REFUNDED' then 'refunded' when 'PARTIALLY_REFUNDED' then 'partially_refunded' when 'PENDING' then 'unpaid'
        when 'AUTHORIZED' then 'authorized' when 'VOIDED' then 'voided' when 'EXPIRED' then 'expired' end=p_payment end)
    and (nullif(btrim(p_search),'') is null or (length(p_search)<=200 and
      strpos(lower(concat_ws(' ',o.order_number,o.reference_order_id,customer.name,customer.phone,d.details->>'sourceNumber',d.details->'customer'->>'name',s.order_gid)),lower(btrim(p_search)))>0))
    and case coalesce(p_view,'all')
      when 'all' then true
      when 'active' then o.order_status::text not in ('completed','delivered','cancelled')
      when 'draft' then o.order_status='draft'
      when 'due_soon' then o.order_status::text not in ('completed','delivered','cancelled') and
        o.promised_delivery_date between (current_timestamp at time zone 'Asia/Kolkata')::date and (current_timestamp at time zone 'Asia/Kolkata')::date+3
      when 'delayed' then o.order_status::text not in ('completed','delivered','cancelled') and o.promised_delivery_date<(current_timestamp at time zone 'Asia/Kolkata')::date
      when 'unpaid' then o.source<>'shopify' and o.payment_status='unpaid'
      when 'partially_paid' then o.source<>'shopify' and o.payment_status='partially_paid'
      when 'ready_dispatch' then o.order_status<>'draft' and exists(select 1 from public.operational_order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status::text in ('completed','ready_for_pickup','ready_for_dispatch','dispatched'))
        and not exists(select 1 from public.operational_order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status='delivered')
      when 'delivered' then o.order_status::text in ('completed','delivered') or exists(select 1 from public.operational_order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status='delivered')
      else false end
  order by o.created_at desc,o.id desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,least(coalesce(p_offset,0),10000));
$$;
revoke all on function public.list_shopify_commercial_orders(uuid,text,text,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_shopify_commercial_orders(uuid,text,text,text,text,text,text,text,text,integer,integer) to service_role;

-- Source-payment facts survive raw expiry and manager completion. This returns
-- no customer contact/address data. A later incomplete revision does not fall
-- back to an older payment and accidentally present it as current.
create function public.read_shopify_retained_payment(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('tenantId',o.tenant_id,'orderId',o.id,
    'payment',jsonb_set(d.details->'payment','{productionHeld}',to_jsonb(case when o.order_status='draft' then false else coalesce(st.held,true) end)))
  from public.orders o
  join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id and c.shop_gid=s.shop_gid
  join lateral(select r.id from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  left join public.shopify_operational_state st on st.tenant_id=s.tenant_id and st.source_order_id=s.id
  where o.tenant_id=p_tenant_id and o.id=p_order_id and o.deleted_at is null and o.source='shopify'
    and c.environment='production' and c.canonical_domain=p_domain and c.app_ref=p_app_ref
    and exists(select 1 from public.tenants where id=o.tenant_id and status='active')
    and exists(select 1 from public.tenant_users where tenant_id=o.tenant_id and clerk_user_id=p_actor_id and status='active' and role in ('owner_admin','manager'));
$$;
revoke all on function public.read_shopify_retained_payment(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_retained_payment(uuid,text,text,text,uuid) to service_role;

-- Full normalized source details remain available alongside the ordinary
-- production detail page after manager setup. Draft routing stays separate.
create function public.read_shopify_retained_business_order(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('schemaVersion',d.schema_version,'tenantId',o.tenant_id,'orderId',o.id,'number',o.order_number,
    'sourceOrderGid',s.order_gid,'details',jsonb_set(d.details,'{payment}',p.payment->'payment'))
  from public.orders o
  join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id and c.shop_gid=s.shop_gid
  join lateral(select r.id from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  cross join lateral(select public.read_shopify_retained_payment(p_tenant_id,p_actor_id,p_domain,p_app_ref,p_order_id) as payment) p
  where o.tenant_id=p_tenant_id and o.id=p_order_id and o.deleted_at is null and o.source='shopify'
    and c.environment='production' and c.canonical_domain=p_domain and c.app_ref=p_app_ref and p.payment is not null;
$$;
revoke all on function public.read_shopify_retained_business_order(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_retained_business_order(uuid,text,text,text,uuid) to service_role;

-- Bounded list DTO, not 50 full customer/order payloads. Full details are read
-- by the separately authorized single-order reader only when an order opens.
create function public.read_shopify_commercial_summaries(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_ids uuid[])
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('orderId',o.id,'reference',d.details->>'sourceNumber',
    'customerName',d.details->'customer'->>'name','customerPhone',d.details->'customer'->>'phone',
    'currency',d.details->>'currency','paymentLabel',d.details->'payment'->>'statusLabel',
    'total',d.details->'payment'->'amounts'->>'total','received',d.details->'payment'->'amounts'->>'received',
    'itemCount',jsonb_array_length(d.details->'lines')) order by o.id),'[]'::jsonb)
  from public.orders o
  join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
  join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id
  join public.tenants t on t.id=o.tenant_id and t.status='active'
  join lateral(select r.id from public.shopify_source_revisions r where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
  join public.shopify_commercial_details d on d.tenant_id=s.tenant_id and d.source_order_id=s.id and d.revision_id=r.id
  where o.tenant_id=p_tenant_id and o.source='shopify' and o.deleted_at is null and o.id=any(p_order_ids) and cardinality(p_order_ids)<=50
    and c.canonical_domain=p_domain and c.app_ref=p_app_ref and c.environment='production'
    and exists(select 1 from public.tenant_users u where u.tenant_id=o.tenant_id and u.clerk_user_id=p_actor_id and u.status='active' and u.role in ('owner_admin','manager'));
$$;
revoke all on function public.read_shopify_commercial_summaries(uuid,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.read_shopify_commercial_summaries(uuid,text,text,text,uuid[]) to service_role;
