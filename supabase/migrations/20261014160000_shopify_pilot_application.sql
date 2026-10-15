-- LOCAL CANDIDATE ONLY. No activation, source copy, subscription or backfill.
-- One named real-store order per pilot installation. Later expansion is a
-- separate owner decision, not an environment flag that silently imports more.
create table public.shopify_pilot_policies (
  tenant_id uuid not null, connection_id uuid primary key, order_gid text not null,
  authorized_by text not null, reason text not null check(length(btrim(reason)) between 3 and 1000),
  authorized_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  key_id text not null check(key_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  check(order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),
  check(expires_at>authorized_at and expires_at<=authorized_at+interval '7 days'),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
create table public.shopify_application_audit (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,connection_id uuid not null,
  actor_id text not null,request_key uuid not null,action text not null,intent_digest text not null,
  -- Owner reasons/decisions, not source payload, credentials or phone/email.
  detail jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,request_key),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
do $$ declare t text;begin
  foreach t in array array['shopify_pilot_policies','shopify_application_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
    execute format('create trigger shopify_application_immutable before update or delete on public.%I for each row execute function public.protect_shopify_draft_audit()',t);
  end loop;
end $$;

-- Recheck current membership, including pending/disconnected setups. No role or
-- tenant supplied by a browser is sufficient: the server resolves both anew.
create function public.assert_shopify_application_owner(p_tenant uuid,p_connection uuid,p_actor text)
returns public.shopify_connections language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;begin
  perform public.assert_shopify_receipt_reader(p_tenant,p_connection,p_actor);
  select * into c from public.shopify_connections where tenant_id=p_tenant and id=p_connection for update;
  perform 1 from public.tenants where id=p_tenant and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant and clerk_user_id=p_actor and role='owner_admin' and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  return c;
end $$;
revoke all on function public.assert_shopify_application_owner(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.shopify_pilot_policy(p_tenant_id uuid,p_connection_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.shopify_pilot_policies%rowtype;begin
  select * into p from public.shopify_pilot_policies where tenant_id=p_tenant_id and connection_id=p_connection_id for share;
  if not found or p.expires_at<=clock_timestamp() or not exists(select 1 from public.tenants where id=p.tenant_id and status='active')
    or not exists(select 1 from public.tenant_users where tenant_id=p.tenant_id and clerk_user_id=p.authorized_by and role='owner_admin' and status='active') then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
  return to_jsonb(p);
end $$;
revoke all on function public.shopify_pilot_policy(uuid,uuid) from public,anon,authenticated;
grant execute on function public.shopify_pilot_policy(uuid,uuid) to service_role;

-- DB defence as well as the route allowlist. An accidental call to the older
-- queue/import commands cannot copy a second order into an approved pilot.
create function public.guard_shopify_pilot_scope() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;c uuid;g text;p public.shopify_pilot_policies%rowtype;begin
  t:=new.tenant_id;
  if tg_table_name='shopify_sync_jobs' then c:=new.connection_id;g:=new.order_gid;
  elsif tg_table_name='shopify_source_orders' then c:=new.connection_id;g:=new.order_gid;
  else select connection_id,order_gid into c,g from public.shopify_source_orders where tenant_id=t and id=new.source_order_id;end if;
  select * into p from public.shopify_pilot_policies where tenant_id=t and connection_id=c for share;
  if found then
    perform public.shopify_pilot_policy(t,c);
    if p.order_gid is distinct from g then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
  end if;
  return new;
end $$;
create trigger shopify_pilot_job_scope before insert or update on public.shopify_sync_jobs for each row execute function public.guard_shopify_pilot_scope();
create trigger shopify_pilot_source_scope before insert on public.shopify_source_orders for each row execute function public.guard_shopify_pilot_scope();
create trigger shopify_pilot_revision_scope before insert on public.shopify_source_revisions for each row execute function public.guard_shopify_pilot_scope();
create trigger shopify_pilot_release_scope before insert on public.shopify_releases for each row execute function public.guard_shopify_pilot_scope();
revoke all on function public.guard_shopify_pilot_scope() from public,anon,authenticated,service_role;

-- Server-only command. The owner command contract contains no attestations;
-- only the pinned read-only Shopify transport may create the verification input.
create function public.command_shopify_application(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;a public.shopify_application_audit%rowtype;p public.shopify_pilot_policies%rowtype;
  s public.shopify_source_orders%rowtype;v_hash text;v_result jsonb;v_days integer;v_time timestamptz;v_job uuid;v_request uuid;
begin
  if p_request_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>16384
    or p_action not in ('authorize_copy','queue_order','retry_job','resolve_customer','privacy_note') or p_action is null then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-app:'||p_tenant_id::text||':'||p_request_key::text,0));
  c:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  -- A fresh verification timestamp is not a new owner intent on retry.
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_action,p_input-'verifiedAt'-'sourceCreatedAt'-'shopGid'-'domain'-'keyId'-'enableRelease')::text,'UTF8')),'hex');
  select * into a from public.shopify_application_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if a.actor_id<>p_actor_id or a.connection_id<>p_connection_id or a.action<>p_action or a.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return a.result;
  end if;
  if p_action='authorize_copy' then
    if c.status not in ('pending','verified','paused') or c.environment<>'production' or c.api_version<>'2026-10'
      or p_input->>'shopGid' is distinct from c.shop_gid or p_input->>'domain' is distinct from c.canonical_domain
      or p_input->>'consent' is distinct from 'true' or coalesce(p_input->>'orderGid','') !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'
      or length(coalesce(btrim(p_input->>'reason'),'')) not between 3 and 1000
      or coalesce(p_input->>'keyId','') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    v_time:=(p_input->>'verifiedAt')::timestamptz;v_days:=(p_input->>'retentionDays')::integer;
    if v_time is null or not isfinite(v_time) or v_time>clock_timestamp() or v_time<clock_timestamp()-interval '120 seconds'
      or v_days is null or v_days not between 1 and 7 or (p_input->>'sourceCreatedAt') is null
      or (p_input->>'sourceCreatedAt')::timestamptz<c.import_created_at_cutoff
      or (p_input->>'sourceCreatedAt')::timestamptz>clock_timestamp()
      or c.revision is distinct from (p_input->>'expectedRevision')::bigint then raise exception 'SHOPIFY_STALE_REVISION';end if;
    select * into p from public.shopify_pilot_policies where connection_id=c.id;
    if (found and (p.order_gid is distinct from p_input->>'orderGid' or p.expires_at<=clock_timestamp()))
      or exists(select 1 from public.shopify_privacy_requests where connection_id=c.id and topic in ('customers/redact','shop/redact'))
      or exists(select 1 from public.shopify_sync_jobs where connection_id=c.id and order_gid<>p_input->>'orderGid')
      then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
    -- One timestamp variable avoids a microsecond interval-boundary violation.
    v_time:=clock_timestamp();
    if p.connection_id is null then
      insert into public.shopify_pilot_policies(tenant_id,connection_id,order_gid,authorized_by,reason,authorized_at,expires_at,key_id)
        values(c.tenant_id,c.id,p_input->>'orderGid',p_actor_id,p_input->>'reason',v_time,v_time+make_interval(days=>v_days),p_input->>'keyId');
    end if;
    update public.shopify_connections set status='verified',verified_at=coalesce(verified_at,v_time),scopes_verified_at=v_time,
      protected_customer_fields_verified_at=v_time,source_copy_authorized_at=v_time,intake_enabled=true,processing_enabled=true,draft_import_enabled=true,
      release_enabled=coalesce((p_input->>'enableRelease')::boolean,false) where id=c.id returning * into c;
    v_result:=jsonb_build_object('status','authorized','revision',c.revision,'expiresAt',coalesce(p.expires_at,v_time+make_interval(days=>v_days)));
  elsif p_action='privacy_note' then
    v_request:=(p_input->>'privacyRequestId')::uuid;
    if not exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=c.id and id=v_request)
      or p_input->>'disposition' is null or p_input->>'disposition' not in ('under_review','external_followup','business_retention_review')
      or length(coalesce(btrim(p_input->>'reason'),'')) not between 3 and 1000 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    v_result:=jsonb_build_object('status','recorded','requestId',v_request,'fulfilled',false);
  else
    perform public.shopify_pilot_policy(p_tenant_id,c.id);
    if c.status<>'verified' or not c.processing_enabled then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    if p_action='queue_order' then
      select * into p from public.shopify_pilot_policies where connection_id=c.id;
      v_result:=public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,c.revision,
        'orders/updated',p_request_key,null,'2026-10',p.order_gid,
        encode(sha256(convert_to('pilot:'||p.order_gid||':'||p_request_key::text,'UTF8')),'hex'),clock_timestamp());
    elsif p_action='retry_job' then
      v_job:=(p_input->>'jobId')::uuid;
      if length(coalesce(btrim(p_input->>'reason'),'')) not between 3 and 1000 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
      update public.shopify_sync_jobs set attempts=0,first_attempt_at=null,dead_lettered_at=null,last_error_code=null,next_attempt_at=clock_timestamp()
        where tenant_id=c.tenant_id and connection_id=c.id and id=v_job and completed_generation<requested_generation
          and (lease_expires_at is null or lease_expires_at<=clock_timestamp()) returning id into v_job;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_BUSY';end if;
      v_result:=jsonb_build_object('status','queued','jobId',v_job);
    elsif p_action='resolve_customer' then
      select * into s from public.shopify_source_orders where tenant_id=c.tenant_id and connection_id=c.id and id=(p_input->>'sourceOrderId')::uuid for update;
      if not found or (p_input->>'sourceRevisionId')::uuid is distinct from
        (select id from public.shopify_source_revisions where tenant_id=c.tenant_id and source_order_id=s.id order by generation desc limit 1)
        or length(coalesce(btrim(p_input->>'reason'),'')) not between 3 and 1000 then raise exception 'SHOPIFY_STALE_REVISION';end if;
      perform 1 from public.customers where tenant_id=c.tenant_id and id=(p_input->>'customerId')::uuid and deleted_at is null for share;
      if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID';end if;
      update public.orders set customer_id=(p_input->>'customerId')::uuid,updated_by=p_actor_id
        where tenant_id=c.tenant_id and id=s.order_id and order_status='draft' and deleted_at is null;
      if not found then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
      v_result:=jsonb_build_object('status','resolved','orderId',s.order_id);
    end if;
  end if;
  insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(c.tenant_id,c.id,p_actor_id,p_request_key,p_action,v_hash,p_input-'verifiedAt'-'sourceCreatedAt'-'shopGid'-'domain'-'keyId'-'enableRelease',v_result);
  return v_result;
end $$;
revoke all on function public.command_shopify_application(uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.command_shopify_application(uuid,uuid,text,uuid,text,jsonb) to service_role;

-- Exact committed intent recovery, before revalidation of mutable configuration.
-- It returns only a receipt; cannot create/release anything or change its key.
create function public.recover_shopify_application_release(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,p_source_order_id uuid,p_review_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.shopify_releases%rowtype;begin
  perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
  select * into r from public.shopify_releases where tenant_id=p_tenant_id and request_key=p_request_key;
  if not found then return null;end if;
  if r.actor_id<>p_actor_id or r.source_order_id<>p_source_order_id or r.review_id<>p_review_id
    or not exists(select 1 from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and id=r.source_order_id)
    then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
  return r.result;
end $$;
revoke all on function public.recover_shopify_application_release(uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.recover_shopify_application_release(uuid,uuid,text,uuid,uuid,uuid) to service_role;

-- Private server projection. Ciphertext is decrypted/verified and allowlisted
-- before any DTO reaches React. No service credentials ever enter this result.
create function public.read_shopify_application(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_customer_search text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;v jsonb;begin
  if not exists(select 1 from public.tenants where id=p_tenant_id and status='active')
    or not exists(select 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id and role='owner_admin' and status='active') then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and canonical_domain=p_domain and app_ref=p_app_ref and environment='production';
  v:=jsonb_build_object('connection',case when c.id is null then null else to_jsonb(c) end,
    'policy',(select to_jsonb(p) from public.shopify_pilot_policies p where tenant_id=p_tenant_id and connection_id=c.id),
    'mappings',coalesce((select jsonb_agg(to_jsonb(m)) from (select id,tenant_id,connection_id,variant_gid,sku,classification,item_type_id,workflow_id,standard_size_id,is_active,revision from public.shopify_variant_mappings where tenant_id=p_tenant_id and connection_id=c.id order by id limit 501)m),'[]'),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source',to_jsonb(s),'revision',(select to_jsonb(r) from public.shopify_source_revisions r where r.tenant_id=p_tenant_id and r.source_order_id=s.id order by generation desc limit 1),
      'order',(select jsonb_build_object('id',o.id,'customerId',o.customer_id,'status',o.order_status,'number',o.order_number) from public.orders o where o.tenant_id=p_tenant_id and o.id=s.order_id),
      'review',(select to_jsonb(r) from public.shopify_draft_reviews r where r.tenant_id=p_tenant_id and r.source_order_id=s.id order by version desc limit 1),
      'state',(select to_jsonb(st) from public.shopify_operational_state st where st.tenant_id=p_tenant_id and st.source_order_id=s.id))) from (select * from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=c.id order by created_at desc limit 51)s),'[]'),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'orderGid',j.order_gid,'requested',j.requested_generation,'completed',j.completed_generation,'attempts',j.attempts,'error',j.last_error_code,'deadLetteredAt',j.dead_lettered_at,'nextAttemptAt',j.next_attempt_at,'leaseExpiresAt',j.lease_expires_at)) from public.shopify_sync_jobs j where tenant_id=p_tenant_id and connection_id=c.id),'[]'),
    'privacy',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'topic',r.topic,'receivedAt',r.received_at,'dueAt',r.due_at,'customerGid',r.customer_gid,'orderGids',r.order_gids)) from public.shopify_privacy_requests r where tenant_id=p_tenant_id and connection_id=c.id),'[]'),
    'history',coalesce((select jsonb_agg(to_jsonb(a)) from (
      select * from (
        select id,action,detail,result,created_at from public.shopify_application_audit where tenant_id=p_tenant_id and connection_id=c.id
        union all select id,action,jsonb_build_object('reason',reason_code),result,created_at from public.shopify_connection_audit where tenant_id=p_tenant_id and connection_id=c.id
        union all select id,'mapping_saved',jsonb_build_object('reason',reason),result,created_at from public.shopify_mapping_audit where tenant_id=p_tenant_id and connection_id=c.id
        union all select r.id,'review_saved',jsonb_build_object('reason',r.decision->>'reason'),'{}'::jsonb,r.created_at from public.shopify_draft_reviews r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id where r.tenant_id=p_tenant_id and s.connection_id=c.id
        union all select r.id,'released','{}'::jsonb,r.result,r.created_at from public.shopify_releases r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id where r.tenant_id=p_tenant_id and s.connection_id=c.id
        union all select r.id,'source_change_'||r.action,jsonb_build_object('reason',r.reason),r.result,r.created_at from public.shopify_change_decisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id where r.tenant_id=p_tenant_id and s.connection_id=c.id
        union all select r.id,r.action,'{}'::jsonb,r.result,r.created_at from public.shopify_privacy_audit r join public.shopify_privacy_requests p on p.tenant_id=r.tenant_id and p.id=r.request_id where r.tenant_id=p_tenant_id and p.connection_id=c.id
      ) events order by created_at desc,id limit 100)a),'[]'),
    'itemTypes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.item_types where tenant_id=p_tenant_id and is_active),'[]'),
    'workflows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'itemTypeId',item_type_id)) from public.workflows where tenant_id=p_tenant_id and is_active),'[]'),
    'sizes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',size_label,'itemTypeId',item_type_id)) from public.item_type_standard_sizes where tenant_id=p_tenant_id and is_active),'[]'),
    'customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from (select id,name from public.customers where tenant_id=p_tenant_id and deleted_at is null and (coalesce(p_customer_search,'')='' or strpos(lower(name),lower(left(p_customer_search,100)))>0) order by name,id limit 101)x),'[]'));
  return v;
end $$;
revoke all on function public.read_shopify_application(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.read_shopify_application(uuid,text,text,text,text) to service_role;

create table public.shopify_pilot_external_receipts (
  tenant_id uuid not null,connection_id uuid not null,delivery_id uuid not null,topic text not null,
  body_sha256 text not null check(body_sha256 ~ '^[0-9a-f]{64}$'),result jsonb not null,created_at timestamptz not null default clock_timestamp(),
  primary key(connection_id,delivery_id),foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
alter table public.shopify_pilot_external_receipts enable row level security;
revoke all on public.shopify_pilot_external_receipts from public,anon,authenticated,service_role;
grant select on public.shopify_pilot_external_receipts to service_role;
create trigger shopify_pilot_external_immutable before update or delete on public.shopify_pilot_external_receipts for each row execute function public.protect_shopify_draft_audit();

create function public.receive_shopify_pilot_event(p_tenant_id uuid,p_connection_id uuid,p_envelope jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;p public.shopify_pilot_policies%rowtype;r public.shopify_pilot_external_receipts%rowtype;v_result jsonb;begin
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id and environment='production' for update;
  if not found or c.verified_at is null then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into r from public.shopify_pilot_external_receipts where connection_id=c.id and delivery_id=(p_envelope->>'deliveryId')::uuid;
  if found then
    if r.topic is distinct from p_envelope->>'topic' or r.body_sha256 is distinct from p_envelope->>'bodySha256' then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return r.result;
  end if;
  select * into p from public.shopify_pilot_policies where tenant_id=c.tenant_id and connection_id=c.id;
  if not found then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
  if p_envelope->>'orderGid' is distinct from p.order_gid then
    v_result:=jsonb_build_object('status','ignored','receiptId',(p_envelope->>'deliveryId')::uuid);
    insert into public.shopify_pilot_external_receipts(tenant_id,connection_id,delivery_id,topic,body_sha256,result)
      values(c.tenant_id,c.id,(p_envelope->>'deliveryId')::uuid,p_envelope->>'topic',p_envelope->>'bodySha256',v_result);
    return v_result;
  end if;
  return public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,(p_envelope->>'connectionRevision')::bigint,
    p_envelope->>'topic',(p_envelope->>'deliveryId')::uuid,(p_envelope->>'eventId')::uuid,'2026-10',p.order_gid,p_envelope->>'bodySha256',(p_envelope->>'triggeredAt')::timestamptz);
end $$;
revoke all on function public.receive_shopify_pilot_event(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_shopify_pilot_event(uuid,uuid,jsonb) to service_role;

-- A bounded reconciliation watermark is the immutable last source revision.
-- Connection lock serializes polling with webhook/manual enqueue and claiming.
-- Only the approved order is queried; no store-wide polling/fan-out exists.
create function public.observe_shopify_pilot(p_tenant_id uuid,p_connection_id uuid,p_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;p public.shopify_pilot_policies%rowtype;v_last timestamptz;v_key uuid;begin
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found or c.status<>'verified' or not c.processing_enabled then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform public.shopify_pilot_policy(c.tenant_id,c.id);
  select * into p from public.shopify_pilot_policies where connection_id=c.id;
  select max(r.source_updated_at) into v_last from public.shopify_source_orders s join public.shopify_source_revisions r on r.source_order_id=s.id and r.tenant_id=s.tenant_id
    where s.tenant_id=c.tenant_id and s.connection_id=c.id and s.order_gid=p.order_gid;
  if (p_updated_at is not null and v_last>=p_updated_at) or exists(select 1 from public.shopify_sync_jobs where connection_id=c.id and completed_generation<requested_generation)
    then return jsonb_build_object('status','unchanged');end if;
  -- Missing source becomes a validation failure in the existing hydrator; never
  -- cancels/deletes local work. One retryable request per hour for that case.
  v_key:=md5(c.id::text||':'||coalesce(p_updated_at::text,date_trunc('hour',clock_timestamp())::text))::uuid;
  return public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,c.revision,'orders/updated',v_key,null,'2026-10',p.order_gid,
    encode(sha256(convert_to(v_key::text,'UTF8')),'hex'),clock_timestamp());
end $$;
revoke all on function public.observe_shopify_pilot(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.observe_shopify_pilot(uuid,uuid,timestamptz) to service_role;

create function public.uninstall_shopify_pilot(p_tenant_id uuid,p_connection_id uuid,p_shop_gid text,p_delivery_id uuid,p_body_sha256 text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;r public.shopify_pilot_external_receipts%rowtype;v_result jsonb;begin
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id and shop_gid=p_shop_gid and environment='production' for update;
  if not found or c.verified_at is null or p_delivery_id is null or coalesce(p_body_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into r from public.shopify_pilot_external_receipts where connection_id=c.id and delivery_id=p_delivery_id;
  if found then
    if r.topic<>'app/uninstalled' or r.body_sha256<>p_body_sha256 then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return r.result;
  end if;
  update public.shopify_connections set status='disconnected',intake_enabled=false,processing_enabled=false,draft_import_enabled=false,release_enabled=false where id=c.id;
  v_result:=jsonb_build_object('status','disconnected');
  insert into public.shopify_pilot_external_receipts(tenant_id,connection_id,delivery_id,topic,body_sha256,result)
    values(c.tenant_id,c.id,p_delivery_id,'app/uninstalled',p_body_sha256,v_result);
  return v_result;
end $$;
revoke all on function public.uninstall_shopify_pilot(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.uninstall_shopify_pilot(uuid,uuid,text,uuid,text) to service_role;

-- Preserve the existing exact-request redaction exception, adding only an
-- expired-policy marker. No edits to source facts, identity or history allowed.
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
  end if;
  raise exception 'SHOPIFY_AUDIT_IMMUTABLE';
end $$;

create function public.purge_expired_shopify_pilot(p_tenant_id uuid,p_connection_id uuid,p_actor_id text default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;p public.shopify_pilot_policies%rowtype;v_count integer;v_remaining integer;v_result jsonb;begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  if p_actor_id is not null then perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);end if;
  select * into p from public.shopify_pilot_policies where tenant_id=p_tenant_id and connection_id=c.id;
  if not found or p.expires_at>clock_timestamp() then return jsonb_build_object('status','not_expired','redactedCount',0);end if;
  with targets as (select r.id from public.shopify_source_revisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id
    where r.tenant_id=c.tenant_id and s.connection_id=c.id and s.order_gid=p.order_gid and r.sealed_source ? 'ciphertext' order by r.id limit p_limit for update of r)
    update public.shopify_source_revisions set sealed_source=jsonb_build_object('redactedByPilotPolicy',c.id) where tenant_id=c.tenant_id and id in(select id from targets);
  get diagnostics v_count=row_count;
  select count(*) into v_remaining from public.shopify_source_revisions r join public.shopify_source_orders s on s.tenant_id=r.tenant_id and s.id=r.source_order_id
    where r.tenant_id=c.tenant_id and s.connection_id=c.id and r.sealed_source ? 'ciphertext';
  if c.processing_enabled or c.draft_import_enabled or c.release_enabled then
    update public.shopify_connections set processing_enabled=false,draft_import_enabled=false,release_enabled=false where tenant_id=c.tenant_id and id=c.id;
  end if;
  v_result:=jsonb_build_object('status','expired_source_purge','redactedCount',v_count,'remainingCount',v_remaining,'businessDispositionRequired',true);
  if v_count>0 then insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(c.tenant_id,c.id,coalesce(p_actor_id,'SYSTEM'),gen_random_uuid(),'expired_source_purge',encode(sha256(convert_to(c.id::text||':'||v_count::text,'UTF8')),'hex'),
      jsonb_build_object('reason','Expired pilot source copies redacted. Business-record disposition remains required.'),v_result);end if;
  return v_result;
end $$;
revoke all on function public.purge_expired_shopify_pilot(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.purge_expired_shopify_pilot(uuid,uuid,text,integer) to service_role;

-- Private owner-only review locator. Decryption remains server-side and only
-- this exact request's contact can enter its downloadable review package.
create function public.read_shopify_privacy_review(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.shopify_privacy_requests%rowtype;begin
  perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
  select * into r from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=p_connection_id and id=p_request_id;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  return jsonb_build_object('id',r.id,'tenantId',r.tenant_id,'connectionId',r.connection_id,'deliveryId',r.delivery_id,'bodySha256',r.body_sha256,'sealedContact',r.sealed_contact);
end $$;
revoke all on function public.read_shopify_privacy_review(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_privacy_review(uuid,uuid,text,uuid) to service_role;
