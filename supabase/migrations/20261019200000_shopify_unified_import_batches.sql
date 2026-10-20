-- DRAFT. Dormant replacement for the one-order pilot. No policy is seeded and
-- no imports are enabled by installing this migration. Shared use needs approval.
create table public.shopify_unified_policies (
  tenant_id uuid not null,connection_id uuid primary key,actor_id text not null,
  approved_at timestamptz not null default clock_timestamp(),automatic_enabled boolean not null default false,
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
create table public.shopify_import_previews (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,connection_id uuid not null,
  actor_id text not null,request_key uuid not null,connection_revision bigint not null,
  window_start timestamptz not null,window_end timestamptz not null,rows jsonb not null,
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
  unique(tenant_id,request_key),unique(tenant_id,id),
  check(isfinite(window_start) and isfinite(window_end) and window_end>window_start and window_end<=window_start+interval '31 days'),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict
);
create table public.shopify_import_authorizations (
  tenant_id uuid not null,connection_id uuid not null,order_gid text not null,
  earliest_created_at timestamptz not null,preview_id uuid,created_at timestamptz not null default clock_timestamp(),
  primary key(connection_id,order_gid),check(order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),check(isfinite(earliest_created_at)),
  foreign key(tenant_id,connection_id) references public.shopify_connections(tenant_id,id) on delete restrict,
  foreign key(tenant_id,preview_id) references public.shopify_import_previews(tenant_id,id) on delete restrict
);
do $$ declare t text;begin
  foreach t in array array['shopify_unified_policies','shopify_import_previews','shopify_import_authorizations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
  end loop;
end $$;
create trigger shopify_preview_immutable before update or delete on public.shopify_import_previews
  for each row execute function public.protect_shopify_draft_audit();

create function public.assert_shopify_unified_policy(p_tenant uuid,p_connection uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.shopify_unified_policies p join public.shopify_business_retention_policies r
    on r.tenant_id=p.tenant_id and r.connection_id=p.connection_id
    join public.tenants t on t.id=p.tenant_id
    join public.tenant_users u on u.tenant_id=p.tenant_id and u.clerk_user_id=p.actor_id
    where p.tenant_id=p_tenant and p.connection_id=p_connection and t.status='active' and u.status='active' and u.role='owner_admin'
    for share of p,r,t,u;
  if not found or exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant and connection_id=p_connection
    and topic in ('customers/redact','shop/redact')) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
end $$;
revoke all on function public.assert_shopify_unified_policy(uuid,uuid) from public,anon,authenticated,service_role;

create function public.enable_shopify_unified_imports(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_domain text,p_app_ref text,
  p_request_key uuid,p_expected_revision bigint,p_consent boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;a public.shopify_application_audit%rowtype;v_result jsonb;s record;r jsonb;
begin
  c:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  if c.canonical_domain<>p_domain or c.app_ref<>p_app_ref or c.environment<>'production' or p_request_key is null or p_consent is distinct from true
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into a from public.shopify_application_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if a.actor_id<>p_actor_id or a.action<>'enable_unified_imports' or a.connection_id<>c.id then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return a.result;
  end if;
  if c.status<>'verified' or c.revision is distinct from p_expected_revision or c.verified_at is null or c.scopes_verified_at is null
    or c.protected_customer_fields_verified_at is null or c.source_copy_authorized_at is null
    or exists(select 1 from public.shopify_privacy_requests where tenant_id=p_tenant_id and connection_id=c.id and topic in ('customers/redact','shop/redact'))
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform public.approve_shopify_business_retention(p_tenant_id,c.id,p_actor_id,true);
  insert into public.shopify_unified_policies(tenant_id,connection_id,actor_id) values(p_tenant_id,c.id,p_actor_id) on conflict(connection_id) do nothing;
  perform public.assert_shopify_unified_policy(p_tenant_id,c.id);
  -- Preserve existing Test order identities and queued work. This does not
  -- duplicate or rehydrate them, and never authorizes a different connection.
  insert into public.shopify_import_authorizations(tenant_id,connection_id,order_gid,earliest_created_at)
    select p_tenant_id,c.id,x.order_gid,c.import_created_at_cutoff from (
      select order_gid from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=c.id
      union select order_gid from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=c.id) x
    on conflict(connection_id,order_gid) do nothing;
  update public.shopify_connections set intake_enabled=true,processing_enabled=true,draft_import_enabled=true where id=c.id returning * into c;
  -- Refresh already-imported pilot records that predate normalized retention.
  -- This queues the same immutable identities, never another business order.
  -- It is part of the explicit owner enable action, not migration installation.
  if (select count(*) from public.shopify_source_orders so where so.tenant_id=p_tenant_id and so.connection_id=c.id
    and not exists(select 1 from public.shopify_commercial_details d where d.tenant_id=so.tenant_id and d.source_order_id=so.id))>1000
    then raise exception 'SHOPIFY_MIGRATION_REVIEW_REQUIRED';end if;
  for s in select so.order_gid from public.shopify_source_orders so where so.tenant_id=p_tenant_id and so.connection_id=c.id
    and not exists(select 1 from public.shopify_commercial_details d where d.tenant_id=so.tenant_id and d.source_order_id=so.id)
    order by so.id limit 1000 loop
    r:=public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,c.revision,'orders/updated',gen_random_uuid(),null,
      '2026-10',s.order_gid,encode(sha256(convert_to(p_request_key::text||':'||s.order_gid,'UTF8')),'hex'),clock_timestamp());
    if r->>'status'<>'accepted' then raise exception 'SHOPIFY_QUEUE_UNCONFIRMED';end if;
  end loop;
  v_result:=jsonb_build_object('status','ready','connectionId',c.id,'revision',c.revision);
  insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(p_tenant_id,c.id,p_actor_id,p_request_key,'enable_unified_imports','approved-retention-v1',
      '{"retainBusinessRecords":true,"rawRetentionHours":24,"automaticEnabled":false}',v_result);
  return v_result;
end $$;
revoke all on function public.enable_shopify_unified_imports(uuid,uuid,text,text,text,uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.enable_shopify_unified_imports(uuid,uuid,text,text,text,uuid,bigint,boolean) to service_role;

-- Existing pilot rules are preserved exactly for installations not opted in.
create or replace function public.guard_shopify_pilot_scope() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;c uuid;g text;p public.shopify_pilot_policies%rowtype;begin
  t:=new.tenant_id;
  if tg_table_name='shopify_sync_jobs' then c:=new.connection_id;g:=new.order_gid;
  elsif tg_table_name='shopify_source_orders' then c:=new.connection_id;g:=new.order_gid;
  else select connection_id,order_gid into c,g from public.shopify_source_orders where tenant_id=t and id=new.source_order_id;end if;
  if exists(select 1 from public.shopify_unified_policies where tenant_id=t and connection_id=c) then
    perform public.assert_shopify_unified_policy(t,c);
    if not exists(select 1 from public.shopify_import_authorizations where tenant_id=t and connection_id=c and order_gid=g)
      then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
  else
    select * into p from public.shopify_pilot_policies where tenant_id=t and connection_id=c for share;
    if found then
      perform public.shopify_pilot_policy(t,c);
      if p.order_gid is distinct from g then raise exception 'SHOPIFY_COPY_APPROVAL_REQUIRED';end if;
    end if;
  end if;
  return new;
end $$;

-- A date-range import may include older orders, but only individually authorized
-- IDs get a lower cutoff. The immutable connection cutoff is never rewritten.
create function public.shopify_authorized_cutoff(p_tenant uuid,p_connection uuid,p_order_gid text,p_default timestamptz)
returns timestamptz language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cutoff timestamptz;begin
  select a.earliest_created_at into cutoff from public.shopify_import_authorizations a
    join public.shopify_unified_policies p on p.tenant_id=a.tenant_id and p.connection_id=a.connection_id
    where a.tenant_id=p_tenant and a.connection_id=p_connection and a.order_gid=p_order_gid;
  return least(p_default,coalesce(cutoff,p_default));
end $$;
revoke all on function public.shopify_authorized_cutoff(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.shopify_authorized_cutoff(uuid,uuid,text,timestamptz) to service_role;

-- Mechanical, fail-closed replacement of ONLY the two original cutoff checks.
-- No guard is removed. Refuse an unexpected baseline rather than partially
-- patching live definitions. Fixtures exercise both imported and released paths.
do $$ declare f regprocedure;body text;old text;replacement text;begin
  foreach f in array array['public.import_shopify_draft_v1(jsonb,boolean)'::regprocedure,'public.import_shopify_draft(jsonb,boolean)'::regprocedure] loop
    body:=pg_get_functiondef(f);
    if f='public.import_shopify_draft_v1(jsonb,boolean)'::regprocedure then
      old:='v_created<v_connection.import_created_at_cutoff';
      replacement:='v_created<public.shopify_authorized_cutoff(v_tenant,v_conn,p_input->>''sourceOrderGid'',v_connection.import_created_at_cutoff)';
    else
      old:='v_created<c.import_created_at_cutoff';
      replacement:='v_created<public.shopify_authorized_cutoff(c.tenant_id,c.id,p_input->>''sourceOrderGid'',c.import_created_at_cutoff)';
    end if;
    if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'SHOPIFY_MIGRATION_BASELINE_MISMATCH';end if;
    execute replace(body,old,replacement);
  end loop;
end $$;

create function public.save_shopify_import_preview(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_domain text,p_app_ref text,
  p_request_key uuid,p_start timestamptz,p_end timestamptz,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;p public.shopify_import_previews%rowtype;x jsonb;begin
  c:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  perform public.assert_shopify_unified_policy(p_tenant_id,c.id);
  if c.canonical_domain<>p_domain or c.app_ref<>p_app_ref or c.status<>'verified' or not c.processing_enabled
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  if p_request_key is null or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end>clock_timestamp()
    or p_end<=p_start or p_end>p_start+interval '31 days' or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows)>2000 or octet_length(p_rows::text)>2000000 then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if exists(select 1 from jsonb_array_elements(p_rows) candidate group by candidate->>'orderGid' having count(*)>1) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for x in select value from jsonb_array_elements(p_rows) loop
    if not x ?& array['orderGid','reference','createdAt','updatedAt','amount','currency','financialStatus','cancelledAt','status','orderIds','incomingReferenceConflict']
      or (x-array['orderGid','reference','createdAt','updatedAt','amount','currency','financialStatus','cancelledAt','status','orderIds','incomingReferenceConflict'])<>'{}'::jsonb
      or coalesce(x->>'orderGid','') !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$' or length(x->>'reference')>256
      or coalesce(x->>'status','') not in ('new','already_imported','reference_match','conflict')
      or (x->>'createdAt')::timestamptz<p_start or (x->>'createdAt')::timestamptz>=p_end
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  end loop;
  select * into p from public.shopify_import_previews where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if p.actor_id<>p_actor_id or p.connection_id<>c.id or p.window_start<>p_start or p.window_end<>p_end or p.rows<>p_rows
      then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
  else
    insert into public.shopify_import_previews(tenant_id,connection_id,actor_id,request_key,connection_revision,window_start,window_end,rows)
      values(p_tenant_id,c.id,p_actor_id,p_request_key,c.revision,p_start,p_end,p_rows) returning * into p;
  end if;
  return jsonb_build_object('previewId',p.id,'expiresAt',p.expires_at);
end $$;
revoke all on function public.save_shopify_import_preview(uuid,uuid,text,text,text,uuid,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.save_shopify_import_preview(uuid,uuid,text,text,text,uuid,timestamptz,timestamptz,jsonb) to service_role;

create function public.commit_shopify_import_preview(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_domain text,p_app_ref text,
  p_preview_id uuid,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;p public.shopify_import_previews%rowtype;a public.shopify_application_audit%rowtype;
  x jsonb;m jsonb;r jsonb;results jsonb:='[]';v_key text;v_status text;v_receipt jsonb;
begin
  c:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  if c.canonical_domain<>p_domain or c.app_ref<>p_app_ref or p_request_key is null then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into a from public.shopify_application_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if a.actor_id<>p_actor_id or a.connection_id<>c.id or a.action<>'import_date_range' or a.detail->>'previewId' is distinct from p_preview_id::text
      then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return a.result;
  end if;
  perform public.assert_shopify_unified_policy(p_tenant_id,c.id);
  select * into p from public.shopify_import_previews where tenant_id=p_tenant_id and connection_id=c.id and id=p_preview_id and actor_id=p_actor_id;
  if not found or p.expires_at<=clock_timestamp() or p.connection_revision<>c.revision or c.status<>'verified'
    or not c.processing_enabled or not c.intake_enabled or not c.draft_import_enabled then raise exception 'SHOPIFY_STALE_REVISION';end if;
  -- Stable lock order across batches; the importer and manual edits use the same
  -- keys and recheck again when the hydrated business order is actually created.
  for v_key in select distinct public.normalize_shopify_reference(value->>'reference') from jsonb_array_elements(p.rows) order by 1 loop
    if v_key is not null then perform pg_advisory_xact_lock(hashtextextended('shopify-reference:'||p_tenant_id||':'||v_key,0));end if;
  end loop;
  for x in select value from jsonb_array_elements(p.rows) loop
    m:=public.match_shopify_order_reference(p_tenant_id,c.shop_gid,x->>'orderGid',x->>'reference');v_status:=m->>'status';
    if x->>'status'<>'new' then v_status:=x->>'status';
    elsif exists(select 1 from jsonb_array_elements(p.rows) other where other->>'orderGid'<>x->>'orderGid'
      and public.normalize_shopify_reference(other->>'reference')=public.normalize_shopify_reference(x->>'reference')) then v_status:='conflict';end if;
    if v_status='new' then
      if exists(select 1 from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=c.id and order_gid=x->>'orderGid') then
        v_status:='already_queued';
      else
        insert into public.shopify_import_authorizations(tenant_id,connection_id,order_gid,earliest_created_at,preview_id)
          values(p_tenant_id,c.id,x->>'orderGid',(x->>'createdAt')::timestamptz,p.id) on conflict(connection_id,order_gid) do nothing;
        r:=public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,c.revision,'orders/updated',gen_random_uuid(),null,
          '2026-10',x->>'orderGid',encode(sha256(convert_to(p.id::text||':'||(x->>'orderGid'),'UTF8')),'hex'),clock_timestamp());
        if r->>'status'<>'accepted' then raise exception 'SHOPIFY_QUEUE_UNCONFIRMED';end if;
        v_status:='queued';
      end if;
    end if;
    results:=results||jsonb_build_array(jsonb_build_object('orderGid',x->>'orderGid','reference',x->>'reference','status',v_status));
  end loop;
  v_receipt:=jsonb_build_object('status','queued','previewId',p.id,'rows',results);
  insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(p_tenant_id,c.id,p_actor_id,p_request_key,'import_date_range',p.id::text,jsonb_build_object('previewId',p.id),v_receipt);
  return v_receipt;
end $$;
revoke all on function public.commit_shopify_import_preview(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.commit_shopify_import_preview(uuid,uuid,text,text,text,uuid,uuid) to service_role;

create function public.read_shopify_unified_policy(p_tenant_id uuid,p_connection_id uuid,p_domain text,p_app_ref text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.shopify_unified_policies%rowtype;begin
  if not exists(select 1 from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id
    and canonical_domain=p_domain and app_ref=p_app_ref and environment='production') then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into p from public.shopify_unified_policies where tenant_id=p_tenant_id and connection_id=p_connection_id;
  if not found then return null;end if;
  perform public.assert_shopify_unified_policy(p_tenant_id,p_connection_id);
  return jsonb_build_object('connectionId',p.connection_id,'automaticEnabled',p.automatic_enabled);
end $$;
revoke all on function public.read_shopify_unified_policy(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.read_shopify_unified_policy(uuid,uuid,text,text) to service_role;

create function public.set_shopify_unified_automatic(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_domain text,p_app_ref text,
  p_request_key uuid,p_enabled boolean,p_verified_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;a public.shopify_application_audit%rowtype;r jsonb;begin
  c:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  if c.canonical_domain<>p_domain or c.app_ref<>p_app_ref or p_enabled is null or p_request_key is null then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into a from public.shopify_application_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if a.actor_id<>p_actor_id or a.connection_id<>c.id or a.action<>'automatic_sync' or a.detail->'enabled'<>to_jsonb(p_enabled)
      then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;return a.result;
  end if;
  perform public.assert_shopify_unified_policy(p_tenant_id,c.id);
  if p_enabled and (c.status<>'verified' or not c.processing_enabled or p_verified_at is null or not isfinite(p_verified_at)
    or p_verified_at>clock_timestamp() or p_verified_at<clock_timestamp()-interval '120 seconds') then raise exception 'SHOPIFY_STALE_REVISION';end if;
  update public.shopify_unified_policies set automatic_enabled=p_enabled where tenant_id=p_tenant_id and connection_id=c.id;
  r:=jsonb_build_object('status','saved','automaticEnabled',p_enabled);
  insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
    values(p_tenant_id,c.id,p_actor_id,p_request_key,'automatic_sync',p_enabled::text,jsonb_build_object('enabled',p_enabled),r);
  return r;
end $$;
revoke all on function public.set_shopify_unified_automatic(uuid,uuid,text,text,text,uuid,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.set_shopify_unified_automatic(uuid,uuid,text,text,text,uuid,boolean,timestamptz) to service_role;

create function public.receive_shopify_unified_event(p_tenant_id uuid,p_connection_id uuid,p_envelope jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;r jsonb;begin
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  perform public.assert_shopify_unified_policy(p_tenant_id,c.id);
  if not exists(select 1 from public.shopify_unified_policies where tenant_id=p_tenant_id and connection_id=c.id and automatic_enabled) then
    return jsonb_build_object('status','ignored','receiptId',gen_random_uuid());end if;
  if c.status<>'verified' or c.revision is distinct from (p_envelope->>'connectionRevision')::bigint
    or not c.processing_enabled or not c.intake_enabled then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  insert into public.shopify_import_authorizations(tenant_id,connection_id,order_gid,earliest_created_at)
    values(c.tenant_id,c.id,p_envelope->>'orderGid',c.import_created_at_cutoff) on conflict(connection_id,order_gid) do nothing;
  r:=public.receive_shopify_event(c.tenant_id,c.id,c.canonical_domain,c.app_ref,c.environment,c.revision,p_envelope->>'topic',
    (p_envelope->>'deliveryId')::uuid,(p_envelope->>'eventId')::uuid,p_envelope->>'apiVersion',p_envelope->>'orderGid',p_envelope->>'bodySha256',
    (p_envelope->>'triggeredAt')::timestamptz);
  return r;
end $$;
revoke all on function public.receive_shopify_unified_event(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_shopify_unified_event(uuid,uuid,jsonb) to service_role;

create function public.read_shopify_unified_workspace(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;begin
  if not exists(select 1 from public.tenants where id=p_tenant_id and status='active')
    or not exists(select 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id and role='owner_admin' and status='active')
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into c from public.shopify_connections where tenant_id=p_tenant_id and canonical_domain=p_domain and app_ref=p_app_ref and environment='production';
  if not found then return jsonb_build_object('connection',null);end if;
  return jsonb_build_object('connection',jsonb_build_object('id',c.id,'shopGid',c.shop_gid,'status',c.status,'revision',c.revision,
    'ready',c.verified_at is not null and c.scopes_verified_at is not null and c.protected_customer_fields_verified_at is not null and c.source_copy_authorized_at is not null,
    'unified',exists(select 1 from public.shopify_unified_policies where tenant_id=p_tenant_id and connection_id=c.id),
    'pilotOrderGid',(select order_gid from public.shopify_pilot_policies where tenant_id=p_tenant_id and connection_id=c.id),
    'automatic',coalesce((select automatic_enabled from public.shopify_unified_policies where tenant_id=p_tenant_id and connection_id=c.id),false),
    'pending',(select count(*) from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=c.id and requested_generation>completed_generation and dead_lettered_at is null),
    'needsAttention',(select count(*) from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=c.id and requested_generation>completed_generation and dead_lettered_at is not null)));
end $$;
revoke all on function public.read_shopify_unified_workspace(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.read_shopify_unified_workspace(uuid,text,text,text) to service_role;
