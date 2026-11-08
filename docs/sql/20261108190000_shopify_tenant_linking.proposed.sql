-- Apply after 20261020180000_shopify_oauth_credentials.proposed.sql.
-- Service-only background credential access, bound to the verified connection.
begin;
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
      and status<>'disconnected';
    if not found then return null; end if;
    return jsonb_build_object('tenantId',c.tenant_id,'connectionId',c.id,'shopDomain',c.canonical_domain,
      'appRef',c.app_ref,'shopGid',c.shop_gid,'hasCredential',
      exists(select 1 from public.shopify_oauth_credentials where tenant_id=p_tenant_id and connection_id=c.id));
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
      and canonical_domain=p_input->>'shopDomain' and tenant_id<>p_tenant_id) then
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
        and canonical_domain=a.shop_domain and tenant_id<>p_tenant_id)
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
    c:=public.assert_shopify_application_owner(p_tenant_id,(p_input->>'connectionId')::uuid,p_actor_id);
    if p_input->>'consent' is distinct from 'true' or c.status not in ('pending','verified')
      or c.revision is distinct from (p_input->>'revision')::bigint
      or c.canonical_domain is distinct from p_input->>'shopDomain' or c.app_ref is distinct from p_input->>'appRef'
      or c.shop_gid is distinct from p_input->>'shopGid'
      or not exists(select 1 from public.shopify_oauth_credentials where tenant_id=p_tenant_id and connection_id=c.id)
      then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
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
commit;
