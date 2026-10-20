-- Unapplied unified-import foundation: READ-ONLY reference matching.
-- Does not enable imports, change tenant/order rows, replace guards, or grant
-- access to browser roles. Preview is advisory, not authorization to import.
create function public.normalize_shopify_reference(p_value text) returns text
language sql immutable parallel safe set search_path=public,pg_temp as $$
  select nullif(translate(btrim(case when left(btrim(p_value),1)='#'
    then substring(btrim(p_value) from 2) else btrim(p_value) end),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'');
$$;
revoke all on function public.normalize_shopify_reference(text) from public,anon,authenticated,service_role;

-- Internal primitive reused by the committing transaction. It acquires no
-- locks: callers that write MUST serialize both source identity and reference,
-- then invoke it again. The public preview wrapper checks owner + store first.
create function public.match_shopify_order_reference(
  p_tenant_id uuid,p_shop_gid text,p_order_gid text,p_reference text
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_ids jsonb;v_count bigint;v_active boolean;v_unbound boolean;v_reference text;
begin
  select count(*),jsonb_agg(o.id order by o.id),bool_and(o.deleted_at is null)
    into v_count,v_ids,v_active
    from public.shopify_source_orders s join public.orders o on o.tenant_id=s.tenant_id and o.id=s.order_id
    where s.tenant_id=p_tenant_id and s.shop_gid=p_shop_gid and s.order_gid=p_order_gid;
  if v_count>0 then return jsonb_build_object('status',case when v_count=1 and v_active then 'already_imported' else 'conflict' end,'orderIds',v_ids);end if;
  v_reference:=public.normalize_shopify_reference(p_reference);
  if v_reference is null then return jsonb_build_object('status','conflict','orderIds','[]'::jsonb);end if;
  select count(*),jsonb_agg(o.id order by o.id),bool_and(o.deleted_at is null),
    bool_and(o.source<>'shopify' and s.id is null)
    into v_count,v_ids,v_active,v_unbound
    from public.orders o left join public.shopify_source_orders s on s.tenant_id=o.tenant_id and s.order_id=o.id
    where o.tenant_id=p_tenant_id and public.normalize_shopify_reference(o.reference_order_id)=v_reference;
  return jsonb_build_object('status',case when v_count=0 then 'new'
    when v_count=1 and v_active and v_unbound then 'reference_match' else 'conflict' end,'orderIds',coalesce(v_ids,'[]'::jsonb));
end $$;
revoke all on function public.match_shopify_order_reference(uuid,text,text,text) from public,anon,authenticated,service_role;

create function public.preview_shopify_order_matches(
  p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_shop_gid text,p_orders jsonb
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_order jsonb;v_result jsonb:='[]'::jsonb;
begin
  if not exists(select 1 from public.shopify_connections c join public.tenants t on t.id=c.tenant_id
    where c.tenant_id=p_tenant_id and c.id=p_connection_id and c.canonical_domain=p_domain and c.app_ref=p_app_ref
      and c.shop_gid=p_shop_gid and c.environment='production' and c.status in ('verified','paused') and c.verified_at is not null
      and t.status='active')
    or not exists(select 1 from public.tenant_users u where u.tenant_id=p_tenant_id and u.clerk_user_id=p_actor_id
      and u.status='active' and u.role='owner_admin')
    or exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=p_connection_id
      and topic in ('customers/redact','shop/redact')) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  if p_orders is null or jsonb_typeof(p_orders)<>'array' then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if jsonb_array_length(p_orders)>100 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if exists(select 1 from jsonb_array_elements(p_orders) x group by x->>'orderGid' having count(*)>1) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for v_order in select value from jsonb_array_elements(p_orders) loop
    if jsonb_typeof(v_order)<>'object' then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    if (v_order-'orderGid'-'reference')<>'{}'::jsonb or not (v_order ?& array['orderGid','reference'])
      or jsonb_typeof(v_order->'orderGid')<>'string' or v_order->>'orderGid' !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'
      or jsonb_typeof(v_order->'reference') not in ('string','null')
      or length(v_order->>'reference')>256 or v_order->>'reference' ~ '[\x01-\x1f\x7f]'
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('orderGid',v_order->>'orderGid')||
      public.match_shopify_order_reference(p_tenant_id,p_shop_gid,v_order->>'orderGid',v_order->>'reference'));
  end loop;
  return v_result;
end $$;
revoke all on function public.preview_shopify_order_matches(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.preview_shopify_order_matches(uuid,uuid,text,text,text,text,jsonb) to service_role;
