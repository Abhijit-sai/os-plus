-- DRAFT: dormant raw-payload cleanup, not a scheduler or an activation.
-- Applies only to explicitly opted-in business-retention connections. Covers
-- partial revisions too: they have no commercial-details row. Never deletes
-- business records, changes connection flags, or extends a source's lifetime.
create index shopify_raw_expiry_candidates on public.shopify_source_revisions(tenant_id,observed_at,id)
  where sealed_source ? 'ciphertext';

create or replace function public.guard_shopify_source_redaction() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and current_user=pg_get_userbyid((select relowner from pg_class where oid=tg_relid))
    and (to_jsonb(new)-'sealed_source')=(to_jsonb(old)-'sealed_source') then
    if new.sealed_source=jsonb_build_object('redactedByRequest',new.sealed_source->>'redactedByRequest')
      and exists(select 1 from public.shopify_privacy_requests r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.connection_id=r.connection_id
        where r.id=(new.sealed_source->>'redactedByRequest')::uuid and r.tenant_id=old.tenant_id and s.id=old.source_order_id and r.topic<>'customers/data_request'
          and (r.topic='shop/redact' or r.order_gids ? s.order_gid or r.customer_gid=old.source_customer_gid)) then return new;end if;
    if new.sealed_source=jsonb_build_object('redactedByPilotPolicy',new.sealed_source->>'redactedByPilotPolicy')
      and exists(select 1 from public.shopify_pilot_policies p join public.shopify_source_orders s on s.tenant_id=p.tenant_id and s.connection_id=p.connection_id
        where p.connection_id=(new.sealed_source->>'redactedByPilotPolicy')::uuid and p.tenant_id=old.tenant_id and s.id=old.source_order_id
          and p.order_gid=s.order_gid and p.expires_at<=clock_timestamp()) then return new;end if;
    if old.sealed_source ? 'ciphertext'
      and new.sealed_source=jsonb_build_object('redactedByRetentionPolicy',new.sealed_source->>'redactedByRetentionPolicy')
      and exists(select 1 from public.shopify_business_retention_policies p
        join public.shopify_source_orders s on s.tenant_id=p.tenant_id and s.connection_id=p.connection_id
        where p.connection_id=(new.sealed_source->>'redactedByRetentionPolicy')::uuid
          and p.tenant_id=old.tenant_id and s.id=old.source_order_id and p.retain_business_records
          and isfinite(old.observed_at) and old.observed_at+interval '24 hours'<=clock_timestamp()) then return new;end if;
  end if;
  raise exception 'SHOPIFY_AUDIT_IMMUTABLE';
end $$;

create function public.purge_expired_shopify_raw(p_tenant_id uuid,p_connection_id uuid,p_shop_domain text,p_app_ref text,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;v_count integer;v_remaining boolean;v_result jsonb;begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  -- Keep lock order consistent with importer/privacy operations. Cleanup also
  -- works after pause/uninstall/tenant deactivation: expiry is not sync work.
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id
    and canonical_domain=p_shop_domain and app_ref=p_app_ref and environment='production' for update;
  if not found or not exists(select 1 from public.shopify_business_retention_policies
    where tenant_id=p_tenant_id and connection_id=p_connection_id and retain_business_records)
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  with targets as (
    select r.id from public.shopify_source_revisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id
    where r.tenant_id=c.tenant_id and s.connection_id=c.id and r.sealed_source ? 'ciphertext'
      and isfinite(r.observed_at) and r.observed_at+interval '24 hours'<=clock_timestamp()
    order by r.observed_at,r.id limit p_limit for update of r
  ) update public.shopify_source_revisions set sealed_source=jsonb_build_object('redactedByRetentionPolicy',c.id)
    where tenant_id=c.tenant_id and id in(select id from targets);
  get diagnostics v_count=row_count;
  select exists(select 1 from public.shopify_source_revisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id
    where r.tenant_id=c.tenant_id and s.connection_id=c.id and r.sealed_source ? 'ciphertext'
      and isfinite(r.observed_at) and r.observed_at+interval '24 hours'<=clock_timestamp()) into v_remaining;
  v_result:=jsonb_build_object('redactedCount',v_count,'hasMore',v_remaining);
  if v_count>0 then insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(c.tenant_id,c.id,'SYSTEM',gen_random_uuid(),'raw_retention_cleanup',
      encode(sha256(convert_to(c.id::text||':'||v_count::text,'UTF8')),'hex'),
      jsonb_build_object('reason','Expired temporary Shopify payloads redacted; business records retained.'),v_result);end if;
  return v_result;
end $$;
revoke all on function public.purge_expired_shopify_raw(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.purge_expired_shopify_raw(uuid,uuid,text,text,integer) to service_role;
