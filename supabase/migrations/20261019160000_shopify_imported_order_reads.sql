-- Commercial visibility is independent of production release. Existing
-- operational/finance/public views and all mutation guards remain unchanged.
-- Returns encrypted source only to the trusted server, never to browser roles.
create function public.read_shopify_imported_orders(
  p_tenant_id uuid, p_actor_id text, p_domain text, p_app_ref text,
  p_order_id uuid default null, p_search text default null
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id desc),'[]'::jsonb)
  from (
    select o.id,o.created_at,jsonb_build_object(
      'tenantId',o.tenant_id,'orderId',o.id,'number',o.order_number,
      'connectionId',s.connection_id,'shopGid',s.shop_gid,'sourceOrderGid',s.order_gid,
      'sourceDigest',r.source_digest,'sourceUpdatedAt',r.source_updated_at,'observedAt',r.observed_at,
      'completeness',r.completeness,'expiresAt',p.expires_at,
      'sealedSource',case when p.expires_at>now() then r.sealed_source else null end
    ) as payload
    from public.orders o
    join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
    join public.shopify_connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id and c.shop_gid=s.shop_gid
    join public.shopify_pilot_policies p on p.tenant_id=c.tenant_id and p.connection_id=c.id and p.order_gid=s.order_gid
    join lateral (select r.* from public.shopify_source_revisions r
      where r.tenant_id=s.tenant_id and r.source_order_id=s.id order by r.generation desc limit 1) r on true
    join public.tenants t on t.id=o.tenant_id and t.status='active'
    left join public.customers customer on customer.tenant_id=o.tenant_id and customer.id=o.customer_id and customer.deleted_at is null
    where o.tenant_id=p_tenant_id and o.source='shopify' and o.order_status='draft' and o.deleted_at is null
      and c.canonical_domain=p_domain and c.app_ref=p_app_ref and c.environment='production'
      and (p_order_id is null or o.id=p_order_id)
      and exists(select 1 from public.tenant_users u where u.tenant_id=p_tenant_id and u.clerk_user_id=p_actor_id
        and u.status='active' and u.role in ('owner_admin','manager'))
      and (nullif(btrim(p_search),'') is null or strpos(lower(o.order_number),lower(btrim(p_search)))>0
        or strpos(lower(coalesce(customer.name,'')),lower(btrim(p_search)))>0
        or strpos(s.order_gid,btrim(p_search))>0)
    order by o.created_at desc,o.id desc limit 50
  ) x;
$$;
revoke all on function public.read_shopify_imported_orders(uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.read_shopify_imported_orders(uuid,text,text,text,uuid,text) to service_role;
