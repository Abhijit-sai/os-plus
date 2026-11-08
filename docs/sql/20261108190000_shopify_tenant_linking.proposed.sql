-- Apply after 20261020180000_shopify_oauth_credentials.proposed.sql.
-- Service-only background credential access, bound to the verified connection.
begin;
-- A cutover preserves the old connection identity and order history. The
-- destination gets a fresh pending connection in the same transaction.
alter table public.shopify_connections
  add column retired_at timestamptz,
  add constraint shopify_retired_connection_disabled check (
    retired_at is null or (status='disconnected' and not intake_enabled and not processing_enabled
      and not draft_import_enabled and not release_enabled)
  );
alter table public.shopify_connections
  drop constraint shopify_connections_environment_shop_gid_key,
  drop constraint shopify_connections_environment_canonical_domain_key;
create unique index shopify_connections_reserved_shop on public.shopify_connections(environment,shop_gid)
  where retired_at is null;
create unique index shopify_connections_reserved_domain on public.shopify_connections(environment,canonical_domain)
  where retired_at is null;

create table public.shopify_store_transfers (
  source_connection_id uuid primary key references public.shopify_connections(id) on delete restrict,
  destination_connection_id uuid not null unique references public.shopify_connections(id) on delete restrict,
  request_key uuid not null unique,
  source_revision bigint not null,
  transferred_at timestamptz not null default clock_timestamp()
);
alter table public.shopify_store_transfers enable row level security;
revoke all on public.shopify_store_transfers from public,anon,authenticated,service_role;
create trigger shopify_store_transfers_immutable before update or delete on public.shopify_store_transfers
  for each row execute function public.protect_shopify_intake_audit();

create function public.transfer_shopify_store(
  p_source_tenant uuid,p_source_connection uuid,p_expected_revision bigint,p_destination_tenant uuid,p_request_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  source public.shopify_connections%rowtype;
  destination public.shopify_connections%rowtype;
  prior public.shopify_store_transfers%rowtype;
begin
  if p_source_tenant is null or p_source_connection is null or p_expected_revision is null
    or p_destination_tenant is null or p_source_tenant=p_destination_tenant or p_request_key is null
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;

  -- Take tenant locks in a fixed order, like OAuth, then fence new shop claims.
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth:'||least(p_source_tenant,p_destination_tenant)::text,0));
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth:'||greatest(p_source_tenant,p_destination_tenant)::text,0));
  select * into source from public.shopify_connections
    where tenant_id=p_source_tenant and id=p_source_connection and environment='production';
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||source.canonical_domain,0));
  select * into source from public.shopify_connections where id=p_source_connection for update;

  select * into prior from public.shopify_store_transfers where request_key=p_request_key;
  if found then
    select * into destination from public.shopify_connections where id=prior.destination_connection_id;
    if prior.source_connection_id<>source.id or prior.source_revision<>p_expected_revision
      or destination.tenant_id<>p_destination_tenant then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','transferred','connectionId',destination.id);
  end if;

  if source.revision<>p_expected_revision then raise exception 'SHOPIFY_STALE_REVISION'; end if;
  if source.status<>'verified' or source.retired_at is not null or source.verified_at is null
    or exists(select 1 from public.shopify_store_transfers where destination_connection_id=source.id)
    or exists(select 1 from public.shopify_connections where tenant_id=p_destination_tenant and environment='production')
    or not exists(select 1 from public.tenants where id=p_destination_tenant and status='active')
    or not exists(select 1 from public.tenant_users where tenant_id=p_destination_tenant and role='owner_admin' and status='active')
    then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  if exists(select 1 from public.shopify_unified_policies where connection_id=source.id and automatic_enabled)
    or exists(select 1 from public.shopify_privacy_requests where connection_id=source.id
      and topic in ('customers/redact','shop/redact'))
    or exists(select 1 from public.shopify_sync_jobs where connection_id=source.id
      and ((requested_generation>completed_generation and dead_lettered_at is null) or lease_expires_at>clock_timestamp()))
    or exists(select 1 from public.shopify_oauth_attempts where status='claimed' and expires_at>clock_timestamp()
      and (tenant_id in (p_source_tenant,p_destination_tenant) or shop_domain=source.canonical_domain))
    or exists(select 1 from public.shopify_oauth_credentials where connection_id=source.id
      and refresh_lease is not null and refresh_started_at>clock_timestamp()-interval '60 seconds')
    then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;

  update public.shopify_oauth_attempts set status='superseded' where status='pending'
    and (tenant_id in (p_source_tenant,p_destination_tenant) or shop_domain=source.canonical_domain);
  delete from public.shopify_oauth_credentials where tenant_id=p_source_tenant and connection_id=source.id;
  update public.shopify_connections set retired_at=clock_timestamp(),status='disconnected',intake_enabled=false,
    processing_enabled=false,draft_import_enabled=false,release_enabled=false where id=source.id;
  insert into public.shopify_connections(tenant_id,shop_gid,canonical_domain,app_ref,environment,import_created_at_cutoff)
    values(p_destination_tenant,source.shop_gid,source.canonical_domain,source.app_ref,'production',clock_timestamp())
    returning * into destination;
  insert into public.shopify_store_transfers(source_connection_id,destination_connection_id,request_key,source_revision)
    values(source.id,destination.id,p_request_key,p_expected_revision);
  return jsonb_build_object('status','transferred','connectionId',destination.id);
end $$;
-- Operator-only SQL. This command is intentionally unavailable to app clients.
revoke all on function public.transfer_shopify_store(uuid,uuid,bigint,uuid,uuid) from public,anon,authenticated,service_role;

create index shopify_oauth_attempts_live_shop
  on public.shopify_oauth_attempts(shop_domain,expires_at) where status in ('pending','claimed');

create or replace function public.shopify_oauth_storage(p_tenant_id uuid,p_actor_id text,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.shopify_oauth_attempts%rowtype;
  c public.shopify_connections%rowtype;
  token public.shopify_oauth_credentials%rowtype;
  result jsonb;
  deadline timestamptz;
begin
  if p_tenant_id is null or p_action is null or p_input is null
    or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>40000 then
    raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  if p_actor_id is null then
    if p_action not in ('read_credential','claim_refresh','finish_refresh') then
      raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  else
    perform 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id
      and status='active' and (role='owner_admin' or p_action='read_connection'
        or (role='manager' and p_action in ('read_credential','claim_refresh','finish_refresh'))) for share;
    if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth:'||p_tenant_id::text,0));

  if p_action='read_connection' then
    select * into c from public.shopify_connections where tenant_id=p_tenant_id and environment='production'
      and (status<>'disconnected' or retired_at is not null)
      order by retired_at nulls first limit 1;
    if not found then return null; end if;
    return jsonb_build_object('tenantId',c.tenant_id,'connectionId',c.id,'shopDomain',c.canonical_domain,
      'appRef',c.app_ref,'shopGid',c.shop_gid,'hasCredential',
      exists(select 1 from public.shopify_oauth_credentials where tenant_id=p_tenant_id and connection_id=c.id))
      || case when c.retired_at is null then '{}'::jsonb else '{"retired":true}'::jsonb end;
  end if;

  if p_action='begin' then
    if exists(select 1 from public.shopify_oauth_attempts where tenant_id=p_tenant_id and status='claimed'
      and expires_at>clock_timestamp()) or exists(select 1 from public.shopify_oauth_credentials
      where tenant_id=p_tenant_id and refresh_lease is not null and refresh_started_at>clock_timestamp()-interval '60 seconds')
      then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;
    deadline:=(p_input->>'expiresAt')::timestamptz;
    if deadline is null or not isfinite(deadline) or deadline<=clock_timestamp()
      or deadline>clock_timestamp()+interval '10 minutes'
      or p_input->>'tenantId' is distinct from p_tenant_id::text
      or p_input->>'actorId' is distinct from p_actor_id then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
    -- A second tenant must not exchange an offline token for the same
    -- installation while an approval from the first tenant is in progress.
    perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||(p_input->>'shopDomain'),0));
    if exists(select 1 from public.shopify_oauth_attempts where shop_domain=p_input->>'shopDomain'
      and tenant_id<>p_tenant_id and status in ('pending','claimed') and expires_at>clock_timestamp())
      then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;
    -- Preserve a tenant's existing store. Switching stores or moving a shop
    -- between Test and Production is a separate, approved migration.
    if exists(select 1 from public.shopify_connections where tenant_id=p_tenant_id and environment='production'
      and (canonical_domain is distinct from p_input->>'shopDomain' or app_ref is distinct from p_input->>'appRef'
        or status='disconnected')) then raise exception 'SHOPIFY_BINDING_IMMUTABLE'; end if;
    if exists(select 1 from public.shopify_connections where environment='production'
      and canonical_domain=p_input->>'shopDomain' and retired_at is null and tenant_id<>p_tenant_id) then
      raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
    update public.shopify_oauth_attempts set status='superseded'
      where tenant_id=p_tenant_id and status in ('pending','claimed');
    insert into public.shopify_oauth_attempts(tenant_id,state_hash,actor_id,shop_domain,app_ref,expires_at)
      values(p_tenant_id,p_input->>'stateHash',p_actor_id,p_input->>'shopDomain',p_input->>'appRef',deadline);
    return jsonb_build_object('status','pending');
  end if;

  if p_action in ('read_attempt','claim','complete') then
    select * into a from public.shopify_oauth_attempts
      where state_hash=p_input->>'stateHash' and tenant_id=p_tenant_id and actor_id=p_actor_id for update;
    if not found or a.expires_at<=clock_timestamp() then raise exception 'SHOPIFY_APPROVAL_EXPIRED'; end if;
    if p_action in ('read_attempt','claim') then
      if a.status<>'pending' then raise exception 'SHOPIFY_APPROVAL_USED'; end if;
      if p_action='read_attempt' then
        return jsonb_build_object('tenantId',a.tenant_id,'actorId',a.actor_id,'shopDomain',a.shop_domain,
          'appRef',a.app_ref,'stateHash',a.state_hash,'expiresAt',a.expires_at);
      end if;
      perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||a.shop_domain,0));
      if exists(select 1 from public.shopify_connections where environment='production'
        and canonical_domain=a.shop_domain and retired_at is null and tenant_id<>p_tenant_id)
        or exists(select 1 from public.shopify_oauth_attempts where shop_domain=a.shop_domain
          and tenant_id<>p_tenant_id and status in ('pending','claimed') and expires_at>clock_timestamp())
        then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;
      -- Renewal can start after the approval page opens. Serialize at the
      -- code-exchange claim too, not only when creating the approval intent.
      if exists(select 1 from public.shopify_oauth_credentials where tenant_id=p_tenant_id
        and refresh_lease is not null and refresh_started_at>clock_timestamp()-interval '60 seconds')
        then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;
      update public.shopify_oauth_attempts set status='claimed',claim_token=gen_random_uuid()
        where state_hash=a.state_hash returning * into a;
      return jsonb_build_object('claimToken',a.claim_token);
    end if;
    if a.status<>'claimed' or a.claim_token is distinct from (p_input->>'claimToken')::uuid then
      raise exception 'SHOPIFY_APPROVAL_USED'; end if;
    if (p_input->>'accessExpiresAt')::timestamptz<=clock_timestamp()+interval '60 seconds'
      or (p_input->>'refreshExpiresAt')::timestamptz<=clock_timestamp()+interval '60 seconds' then
      raise exception 'SHOPIFY_AUTH_REQUIRED'; end if;
    perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||a.shop_domain,0));
    select * into c from public.shopify_connections where tenant_id=p_tenant_id and environment='production' for update;
    if found then
      if c.canonical_domain<>a.shop_domain or c.app_ref<>a.app_ref or c.shop_gid is distinct from p_input->>'shopGid'
        or c.status='disconnected' then raise exception 'SHOPIFY_BINDING_IMMUTABLE'; end if;
    else
      result:=public.register_shopify_connection(p_tenant_id,p_actor_id,a.claim_token,p_input->>'shopGid',
        a.shop_domain,a.app_ref,'production',clock_timestamp());
      select * into c from public.shopify_connections where tenant_id=p_tenant_id and id=(result->>'connectionId')::uuid for update;
    end if;
    insert into public.shopify_oauth_credentials(tenant_id,connection_id,packet,access_expires_at,refresh_expires_at)
      values(p_tenant_id,c.id,p_input->'packet',(p_input->>'accessExpiresAt')::timestamptz,(p_input->>'refreshExpiresAt')::timestamptz)
      on conflict(connection_id) do update set packet=excluded.packet,access_expires_at=excluded.access_expires_at,
        refresh_expires_at=excluded.refresh_expires_at,revision=shopify_oauth_credentials.revision+1,
        refresh_lease=null,refresh_started_at=null,updated_at=clock_timestamp();
    update public.shopify_oauth_attempts set status='connected',connection_id=c.id where state_hash=a.state_hash;
    return jsonb_build_object('status','connected','connectionId',c.id);
  end if;

  if p_action in ('read_credential','claim_refresh','finish_refresh') then
    if exists(select 1 from public.shopify_oauth_attempts where tenant_id=p_tenant_id and status='claimed'
      and expires_at>clock_timestamp()) then raise exception 'SHOPIFY_CONFIGURATION_BUSY'; end if;
    select * into c from public.shopify_connections where tenant_id=p_tenant_id
      and id=(p_input->>'connectionId')::uuid and environment='production' and status<>'disconnected' for share;
    if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
    if p_actor_id is null and (c.status <> 'verified' or not c.processing_enabled
      or c.shop_gid is distinct from p_input->>'shopGid' or c.app_ref is distinct from p_input->>'appRef'
      or c.canonical_domain is distinct from p_input->>'shopDomain'
      or c.revision is distinct from (p_input->>'connectionRevision')::bigint) then
      raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
    select * into token from public.shopify_oauth_credentials where tenant_id=p_tenant_id and connection_id=c.id for update;
    if not found then
      if p_action='read_credential' then return null; end if;
      raise exception 'SHOPIFY_AUTH_REQUIRED';
    end if;
    if p_action in ('claim_refresh','finish_refresh') then
      if token.revision is distinct from (p_input->>'revision')::bigint then raise exception 'SHOPIFY_STALE_REVISION'; end if;
      if token.refresh_expires_at<=clock_timestamp()+interval '60 seconds' then raise exception 'SHOPIFY_AUTH_REQUIRED'; end if;
      if p_action='claim_refresh' then
        if token.refresh_lease is not null then
          -- A timed-out rotation has an unknown upstream outcome. Never reuse
          -- that refresh token. Explicit owner reauthorization is the recovery.
          if token.refresh_started_at<clock_timestamp()-interval '60 seconds' then raise exception 'SHOPIFY_AUTH_REQUIRED'; end if;
          raise exception 'SHOPIFY_REFRESH_BUSY';
        end if;
        update public.shopify_oauth_credentials set refresh_lease=gen_random_uuid(),refresh_started_at=clock_timestamp()
          where connection_id=c.id returning * into token;
        return jsonb_build_object('lease',token.refresh_lease);
      end if;
      if token.refresh_lease is null or token.refresh_lease is distinct from (p_input->>'lease')::uuid
        or token.refresh_started_at<clock_timestamp()-interval '60 seconds' then raise exception 'SHOPIFY_STALE_REVISION'; end if;
      if (p_input->>'accessExpiresAt')::timestamptz<=clock_timestamp()+interval '60 seconds'
        or (p_input->>'refreshExpiresAt')::timestamptz<=clock_timestamp()+interval '60 seconds' then raise exception 'SHOPIFY_AUTH_REQUIRED'; end if;
      update public.shopify_oauth_credentials set packet=p_input->'packet',
        access_expires_at=(p_input->>'accessExpiresAt')::timestamptz,refresh_expires_at=(p_input->>'refreshExpiresAt')::timestamptz,
        revision=revision+1,refresh_lease=null,refresh_started_at=null,updated_at=clock_timestamp() where connection_id=c.id;
      return jsonb_build_object('status','refreshed');
    end if;
    return jsonb_build_object('tenantId',c.tenant_id,'connectionId',c.id,'shopDomain',c.canonical_domain,'appRef',c.app_ref,
      'packet',token.packet,'revision',token.revision,'accessExpiresAt',token.access_expires_at,
      'refreshExpiresAt',token.refresh_expires_at,'refreshPending',token.refresh_lease is not null);
  end if;
  if p_action='enable_imports' then
    perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||(p_input->>'shopDomain'),0));
    c:=public.assert_shopify_application_owner(p_tenant_id,(p_input->>'connectionId')::uuid,p_actor_id);
    if p_input->>'consent' is distinct from 'true' or c.status not in ('pending','verified')
      or c.revision is distinct from (p_input->>'revision')::bigint
      or c.canonical_domain is distinct from p_input->>'shopDomain' or c.app_ref is distinct from p_input->>'appRef'
      or c.shop_gid is distinct from p_input->>'shopGid'
      or not exists(select 1 from public.shopify_oauth_credentials where tenant_id=p_tenant_id and connection_id=c.id)
      then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
    -- Redaction received during the handoff is recorded against the historical
    -- connection while the destination is pending. Hold new imports for review.
    if exists(select 1 from public.shopify_store_transfers t
      join public.shopify_privacy_requests r on r.connection_id=t.source_connection_id
      where t.destination_connection_id=c.id and r.topic in ('customers/redact','shop/redact'))
      then raise exception 'SHOPIFY_PRIVACY_REVIEW'; end if;
    deadline:=(p_input->>'verifiedAt')::timestamptz;
    if deadline is null or not isfinite(deadline) or deadline<clock_timestamp()-interval '60 seconds'
      or deadline>clock_timestamp()+interval '5 seconds' then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
    -- A server-only, successful protected-fields probe and explicit owner
    -- retention consent precede this command. Never part of OAuth callback.
    if c.status='pending' or c.scopes_verified_at is null or c.protected_customer_fields_verified_at is null
      or c.source_copy_authorized_at is null then
      update public.shopify_connections set status='verified',verified_at=coalesce(verified_at,deadline),
        scopes_verified_at=deadline,protected_customer_fields_verified_at=deadline,source_copy_authorized_at=deadline
        where id=c.id returning * into c;
    end if;
    return public.enable_shopify_unified_imports(p_tenant_id,c.id,p_actor_id,c.canonical_domain,c.app_ref,
      (p_input->>'requestKey')::uuid,c.revision,true);
  end if;
  raise exception 'SHOPIFY_COMMAND_INVALID';
end $$;
revoke all on function public.shopify_oauth_storage(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.shopify_oauth_storage(uuid,text,text,jsonb) to service_role;

-- Rotate through all verified shop bindings without trusting request parameters
-- or updating the connection revision. Includes disconnected shops for expiry.
create table public.shopify_worker_rotation (
  connection_id uuid primary key references public.shopify_connections(id) on delete cascade,
  checked_at timestamptz not null
);
alter table public.shopify_worker_rotation enable row level security;
revoke all on public.shopify_worker_rotation from public, anon, authenticated, service_role;
create function public.next_shopify_tenant_worker(p_app_ref text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;
begin
  if p_app_ref is null or p_app_ref !~ '^[A-Za-z0-9_-]+$' or length(p_app_ref)>256
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-worker-rotation:'||p_app_ref,0));
  select s.* into c from public.shopify_connections s
    join public.tenants t on t.id=s.tenant_id
    left join public.shopify_worker_rotation r on r.connection_id=s.id
    where s.environment='production' and s.app_ref=p_app_ref and s.verified_at is not null
      and exists(select 1 from public.shopify_unified_policies p where p.tenant_id=s.tenant_id and p.connection_id=s.id)
    order by r.checked_at asc nulls first,s.id limit 1;
  if not found then return null; end if;
  insert into public.shopify_worker_rotation values(c.id,clock_timestamp())
    on conflict(connection_id) do update set checked_at=excluded.checked_at;
  return jsonb_build_object('connectionId',c.id,'tenantId',c.tenant_id,'shopDomain',c.canonical_domain,
    'canProcess',c.status='verified' and c.processing_enabled and
    exists(select 1 from public.tenants t where t.id=c.tenant_id and t.status='active'));
end $$;
revoke all on function public.next_shopify_tenant_worker(text) from public,anon,authenticated;
grant execute on function public.next_shopify_tenant_worker(text) to service_role;
-- The same Shopify installation has one compliance stream. Record requests
-- separately against the connection IDs that held data, in one transaction.
create function public.receive_shopify_privacy_bindings(p_inputs jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  first_input jsonb;
  item jsonb;
  outcome jsonb;
  response jsonb;
  expected uuid[];
  supplied uuid[];
begin
  if p_inputs is null or jsonb_typeof(p_inputs)<>'array' or jsonb_array_length(p_inputs) not between 1 and 2
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  first_input:=p_inputs->0;
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||(first_input->>'shopDomain'),0));
  select array_agg(id order by id) into expected from public.shopify_connections
    where canonical_domain=first_input->>'shopDomain' and shop_gid=first_input->>'shopGid'
      and app_ref=first_input->>'appRef' and environment='production' and verified_at is not null;
  select array_agg((value->>'connectionId')::uuid order by (value->>'connectionId')::uuid) into supplied
    from jsonb_array_elements(p_inputs);
  if expected is distinct from supplied or exists(select 1 from jsonb_array_elements(p_inputs) x
    where (x-'tenantId'-'connectionId'-'verifiedAt'-'sealedContact') is distinct from
      (first_input-'tenantId'-'connectionId'-'verifiedAt'-'sealedContact'))
    then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;

  for item in select value from jsonb_array_elements(p_inputs) order by value->>'connectionId' loop
    outcome:=public.receive_shopify_privacy(item);
    response:=coalesce(response,outcome);
  end loop;
  return response;
end $$;
revoke all on function public.receive_shopify_privacy_bindings(jsonb) from public,anon,authenticated;
grant execute on function public.receive_shopify_privacy_bindings(jsonb) to service_role;

create function public.read_shopify_transfer_webhook(p_tenant_id uuid,p_connection_id uuid,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  destination public.shopify_connections%rowtype;
  previous jsonb;
begin
  destination:=public.assert_shopify_application_owner(p_tenant_id,p_connection_id,p_actor_id);
  select jsonb_build_object('tenantId',c.tenant_id,'connectionId',c.id,'pilotOrderGid',p.order_gid)
    into previous from public.shopify_store_transfers t
    join public.shopify_connections c on c.id=t.source_connection_id
    left join public.shopify_pilot_policies p on p.connection_id=c.id
    where t.destination_connection_id=destination.id and c.retired_at is not null;
  return previous;
end $$;
revoke all on function public.read_shopify_transfer_webhook(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_shopify_transfer_webhook(uuid,uuid,text) to service_role;
-- Resolve the current installation under the shop lock, so an uninstall
-- arriving during retirement cannot be recorded against the wrong tenant.
create function public.uninstall_shopify_current(
  p_domain text,p_app_ref text,p_shop_gid text,p_delivery_id uuid,p_body_sha256 text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare binding public.shopify_connections%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('shopify-oauth-shop:'||p_domain,0));
  select * into binding from public.shopify_connections
    where canonical_domain=p_domain and app_ref=p_app_ref and shop_gid=p_shop_gid
      and environment='production' and retired_at is null for update;
  if not found then return null; end if;
  if binding.verified_at is null then
    -- Fail closed during a handoff. A callback must obtain a fresh valid
    -- token, and a pending binding never participates in order intake.
    if binding.status='pending' then
      update public.shopify_connections set status='disconnected' where id=binding.id;
      delete from public.shopify_oauth_credentials where connection_id=binding.id and tenant_id=binding.tenant_id;
    end if;
    return jsonb_build_object('status','disconnected');
  end if;
  delete from public.shopify_oauth_credentials where connection_id=binding.id and tenant_id=binding.tenant_id;
  return public.uninstall_shopify_pilot(binding.tenant_id,binding.id,binding.shop_gid,p_delivery_id,p_body_sha256);
end $$;
revoke all on function public.uninstall_shopify_current(text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.uninstall_shopify_current(text,text,text,uuid,text) to service_role;
commit;
