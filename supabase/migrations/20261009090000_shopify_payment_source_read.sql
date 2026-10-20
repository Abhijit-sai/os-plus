-- Read-only source-payment mirror. No local payment/finance/GST mutations.
-- Raw encrypted source stays on trusted servers; browser receives financial DTO only.
create function public.read_shopify_payment_source(p_tenant_id uuid,p_actor_id text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('tenantId',s.tenant_id,'orderId',s.order_id,'connectionId',s.connection_id,
    'shopGid',s.shop_gid,'sourceOrderGid',s.order_gid,'sourceDigest',r.source_digest,
    'sourceUpdatedAt',r.source_updated_at,'observedAt',r.observed_at,'completeness',r.completeness,
    'sealedSource',r.sealed_source,'productionHeld',st.held)
  from public.shopify_source_orders s
  join public.shopify_operational_state st on st.tenant_id=s.tenant_id and st.source_order_id=s.id
  join public.shopify_source_revisions r on r.tenant_id=s.tenant_id and r.source_order_id=s.id and r.id=st.latest_revision_id
  join public.operational_orders o on o.tenant_id=s.tenant_id and o.id=s.order_id
  join public.tenants t on t.id=s.tenant_id and t.status='active'
  where s.tenant_id=p_tenant_id and s.order_id=p_order_id and o.deleted_at is null
    and exists(select 1 from public.tenant_users u where u.tenant_id=p_tenant_id and u.clerk_user_id=p_actor_id
      and u.status='active' and u.role in ('owner_admin','manager'));
$$;
revoke all on function public.read_shopify_payment_source(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_payment_source(uuid,text,uuid) to service_role;
