-- Dormant privacy workflow. No live requests, subscriptions or erasure executed.
-- Receipt is NOT fulfilment. Business/customer retention needs an explicit
-- owner disposition; source-only redaction never claims that work is complete.
create table public.shopify_privacy_requests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, connection_id uuid not null,
  topic text not null check(topic in ('customers/data_request','customers/redact','shop/redact')),
  delivery_id uuid not null, body_sha256 text not null check(body_sha256 ~ '^[0-9a-f]{64}$'),
  customer_gid text check(customer_gid ~ '^gid://shopify/Customer/[1-9][0-9]{0,31}$'),
  order_gids jsonb not null check(jsonb_typeof(order_gids)='array'),
  -- Email-only requests keep minimized encrypted contact, never plaintext email.
  sealed_contact jsonb not null check(jsonb_typeof(sealed_contact)='object'),
  received_at timestamptz not null default clock_timestamp(),
  due_at timestamptz not null default (clock_timestamp()+interval '30 days'),
  unique(tenant_id,id), unique(connection_id,delivery_id),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
create table public.shopify_privacy_audit (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, request_id uuid not null,
  actor_id text not null, request_key uuid not null, intent_digest text not null,
  action text not null check(action in ('source_redaction','contact_purge')), redacted_count integer not null check(redacted_count>=0),
  result jsonb not null, created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,request_key),
  foreign key(tenant_id,request_id) references public.shopify_privacy_requests(tenant_id,id) on delete restrict
);
create table public.shopify_privacy_tombstones (
  tenant_id uuid not null, connection_id uuid not null, identity_key text not null,
  request_id uuid not null, created_at timestamptz not null default clock_timestamp(),
  primary key(connection_id,identity_key),
  check(identity_key='SHOP' or identity_key ~ '^gid://shopify/(Customer|Order)/[1-9][0-9]{0,31}$'),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,request_id) references public.shopify_privacy_requests(tenant_id,id) on delete restrict
);
do $$ declare v_table text; begin
  foreach v_table in array array['shopify_privacy_requests','shopify_privacy_audit','shopify_privacy_tombstones'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    execute format('grant select on public.%I to service_role',v_table);
    execute format('create trigger shopify_privacy_immutable before update or delete on public.%I for each row execute function public.protect_shopify_intake_audit()',v_table);
  end loop;
end $$;

-- A pending data/export request is not destructive and does not stop sync.
-- Any erase receipt stops processing until business-retention disposition is
-- implemented/reviewed. This is intentionally fail-closed, even after source
-- redaction: there is no unsafe resume while an email-only subject is unresolved.
create function public.guard_shopify_privacy_activation() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.processing_enabled or new.draft_import_enabled then
    if exists(select 1 from public.shopify_privacy_requests where tenant_id=new.tenant_id and connection_id=new.id
      and topic in ('customers/redact','shop/redact')) then raise exception 'SHOPIFY_PRIVACY_REVIEW'; end if;
  end if;
  return new;
end $$;
create trigger shopify_privacy_activation before update on public.shopify_connections
  for each row execute function public.guard_shopify_privacy_activation();

-- HMAC/raw-body validation happens before this narrow service RPC. It must bind
-- tenant using a previously verified store, including disconnected stores.
create function public.receive_shopify_privacy(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_conn public.shopify_connections%rowtype; v_request public.shopify_privacy_requests%rowtype;
  v_tenant uuid; v_connection uuid; v_delivery uuid; v_order text;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>2097152 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  v_tenant:=(p_input->>'tenantId')::uuid; v_connection:=(p_input->>'connectionId')::uuid; v_delivery:=(p_input->>'deliveryId')::uuid;
  if v_tenant is null or v_connection is null or v_delivery is null or p_input->>'topic' is null
    or p_input->>'topic' not in ('customers/data_request','customers/redact','shop/redact')
    or coalesce(p_input->>'bodySha256','') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_input->'orderGids') is distinct from 'array' or jsonb_array_length(p_input->'orderGids')>5000
    or jsonb_typeof(p_input->'sealedContact') is distinct from 'object'
    or (p_input->>'customerGid' is not null and p_input->>'customerGid' !~ '^gid://shopify/Customer/[1-9][0-9]{0,31}$')
    or p_input->>'environment' is distinct from 'production' then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_input->'orderGids') x where x !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$') then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  select * into v_conn from public.shopify_connections where tenant_id=v_tenant and id=v_connection
    and shop_gid=p_input->>'shopGid' and canonical_domain=p_input->>'shopDomain'
    and app_ref=p_input->>'appRef' and environment=p_input->>'environment' and verified_at is not null for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  -- Accept privacy even with suspended tenant, revoked token, disabled intake,
  -- disconnected status or erased shop; no Shopify API credential is required.
  select * into v_request from public.shopify_privacy_requests where connection_id=v_connection and delivery_id=v_delivery;
  if found then
    if v_request.body_sha256<>p_input->>'bodySha256' or v_request.topic<>p_input->>'topic' then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','received','requestId',v_request.id);
  end if;
  insert into public.shopify_privacy_requests(tenant_id,connection_id,topic,delivery_id,body_sha256,customer_gid,order_gids,sealed_contact)
    values(v_tenant,v_connection,p_input->>'topic',v_delivery,p_input->>'bodySha256',p_input->>'customerGid',p_input->'orderGids',p_input->'sealedContact') returning * into v_request;
  if v_request.topic<>'customers/data_request' then
    update public.shopify_connections set processing_enabled=false,draft_import_enabled=false where tenant_id=v_tenant and id=v_connection;
    if v_request.topic='shop/redact' then
      insert into public.shopify_privacy_tombstones values(v_tenant,v_connection,'SHOP',v_request.id,clock_timestamp()) on conflict do nothing;
    end if;
    if v_request.customer_gid is not null then
      insert into public.shopify_privacy_tombstones values(v_tenant,v_connection,v_request.customer_gid,v_request.id,clock_timestamp()) on conflict do nothing;
    end if;
    for v_order in select value from jsonb_array_elements_text(v_request.order_gids) loop
      insert into public.shopify_privacy_tombstones values(v_tenant,v_connection,v_order,v_request.id,clock_timestamp()) on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('status','received','requestId',v_request.id);
end $$;

-- Narrow controlled exception to source-revision immutability. Only an owner
-- definer redaction command can replace ciphertext with a request-bound marker;
-- all source IDs/digests/lines/audit and order/production history remain intact.
create function public.guard_shopify_source_redaction() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and current_user=pg_get_userbyid((select relowner from pg_class where oid=tg_relid))
    and (to_jsonb(new)-'sealed_source')=(to_jsonb(old)-'sealed_source')
    and new.sealed_source=jsonb_build_object('redactedByRequest',new.sealed_source->>'redactedByRequest')
    and exists(select 1 from public.shopify_privacy_requests r join public.shopify_source_orders s
      on s.tenant_id=r.tenant_id and s.connection_id=r.connection_id
      where r.id=(new.sealed_source->>'redactedByRequest')::uuid and r.tenant_id=old.tenant_id
        and s.id=old.source_order_id and r.topic<>'customers/data_request'
        and (r.topic='shop/redact' or r.order_gids ? s.order_gid or r.customer_gid=old.source_customer_gid)) then return new; end if;
  raise exception 'SHOPIFY_AUDIT_IMMUTABLE';
end $$;
drop trigger shopify_draft_immutable on public.shopify_source_revisions;
create trigger shopify_draft_immutable before update or delete on public.shopify_source_revisions
  for each row execute function public.guard_shopify_source_redaction();

create function public.redact_shopify_source(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_id uuid,p_request_key uuid,p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.shopify_privacy_requests%rowtype; v_prior public.shopify_privacy_audit%rowtype;
  v_count integer; v_intent text; v_result jsonb;
begin
  if p_actor_id is null or p_request_key is null or p_limit is null or p_limit not between 1 and 100 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  perform 1 from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id and role='owner_admin' and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  v_intent:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_request_id,p_limit)::text,'UTF8')),'hex');
  select * into v_prior from public.shopify_privacy_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if v_prior.actor_id<>p_actor_id or v_prior.intent_digest<>v_intent then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return v_prior.result;
  end if;
  select * into v_request from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=p_connection_id and id=p_request_id;
  if not found or v_request.topic='customers/data_request' then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  with targets as (
    select r.id from public.shopify_source_revisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id
    where r.tenant_id=p_tenant_id and s.connection_id=p_connection_id and not r.sealed_source ? 'redactedByRequest'
      and (v_request.topic='shop/redact' or v_request.order_gids ? s.order_gid or v_request.customer_gid=r.source_customer_gid)
    order by r.id limit p_limit for update of r
  ) update public.shopify_source_revisions set sealed_source=jsonb_build_object('redactedByRequest',p_request_id)
    where tenant_id=p_tenant_id and id in (select id from targets);
  get diagnostics v_count=row_count;
  v_result:=jsonb_build_object('status','source_redaction_batch','redactedCount',v_count,'businessDispositionRequired',true);
  insert into public.shopify_privacy_audit(tenant_id,request_id,actor_id,request_key,intent_digest,action,redacted_count,result)
    values(p_tenant_id,p_request_id,p_actor_id,p_request_key,v_intent,'source_redaction',v_count,v_result);
  return v_result;
end $$;
revoke all on function public.guard_shopify_privacy_activation(),public.guard_shopify_source_redaction(),public.receive_shopify_privacy(jsonb),public.redact_shopify_source(uuid,uuid,text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.receive_shopify_privacy(jsonb),public.redact_shopify_source(uuid,uuid,text,uuid,uuid,integer) to service_role;

-- Minimized transient contact has a seven-day TTL. IDs/hash/deadline remain
-- pending proof after purge; export/erasure never reports success merely on TTL.
create function public.guard_shopify_privacy_contact_purge() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and current_user=pg_get_userbyid((select relowner from pg_class where oid=tg_relid))
    and (to_jsonb(new)-'sealed_contact')=(to_jsonb(old)-'sealed_contact')
    and new.sealed_contact='{"contactPurged":true}'::jsonb and old.received_at<=clock_timestamp()-interval '7 days'
    and (old.topic='shop/redact' or old.customer_gid is not null or jsonb_array_length(old.order_gids)>0)
    then return new; end if;
  raise exception 'SHOPIFY_RECEIPT_IMMUTABLE';
end $$;
drop trigger shopify_privacy_immutable on public.shopify_privacy_requests;
create trigger shopify_privacy_immutable before update or delete on public.shopify_privacy_requests
  for each row execute function public.guard_shopify_privacy_contact_purge();

create function public.purge_shopify_privacy_contacts(p_tenant_id uuid,p_connection_id uuid,p_limit integer default 100) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.shopify_privacy_requests%rowtype; v_count integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  perform 1 from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  for v_row in select * from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=p_connection_id
    and received_at<=clock_timestamp()-interval '7 days' and sealed_contact<>'{"contactPurged":true}'::jsonb
    -- Never erase the sole actionable locator for an unresolved email-only
    -- subject. Owner resolution/export disposition is still required.
    and (topic='shop/redact' or customer_gid is not null or jsonb_array_length(order_gids)>0)
    order by received_at,id limit p_limit for update loop
    update public.shopify_privacy_requests set sealed_contact='{"contactPurged":true}'::jsonb where tenant_id=p_tenant_id and id=v_row.id;
    insert into public.shopify_privacy_audit(tenant_id,request_id,actor_id,request_key,intent_digest,action,redacted_count,result)
      values(p_tenant_id,v_row.id,'SYSTEM',gen_random_uuid(),encode(sha256(convert_to(v_row.id::text,'UTF8')),'hex'),'contact_purge',1,'{"contactPurged":true}'::jsonb);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function public.guard_shopify_privacy_contact_purge(),public.purge_shopify_privacy_contacts(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.purge_shopify_privacy_contacts(uuid,uuid,integer) to service_role;
