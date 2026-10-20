-- Dormant commands only: no enablement, scheduler, credentials or order writes.
alter table public.shopify_connections add column processing_enabled boolean not null default false;
alter table public.shopify_connections add constraint shopify_processing_verified
  check (not processing_enabled or (status = 'verified' and intake_enabled));
-- Administration now goes through audited commands, never bare service writes.
revoke insert, update on public.shopify_connections from service_role;

create table public.shopify_connection_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  actor_kind text not null check (actor_kind in ('USER', 'SYSTEM')),
  actor_id text,
  action text not null check (action in ('register', 'pause', 'resume', 'disconnect', 'auth_pause')),
  reason_code text not null check (reason_code in ('OWNER_SETUP', 'OWNER_PAUSE', 'OWNER_RESUME', 'OWNER_DISCONNECT', 'AUTH_REQUIRED', 'SCOPE_REQUIRED')),
  request_key uuid,
  request_fingerprint jsonb,
  before_revision bigint,
  after_revision bigint not null,
  before_state jsonb,
  after_state jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id) references public.shopify_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, request_key),
  check ((actor_kind = 'USER' and actor_id is not null and request_key is not null and request_fingerprint is not null)
    or (actor_kind = 'SYSTEM' and actor_id is null and request_key is null and request_fingerprint is null))
);
create trigger shopify_connection_audit_immutable before update or delete on public.shopify_connection_audit
  for each row execute function public.protect_shopify_intake_audit();
alter table public.shopify_connection_audit enable row level security;
revoke all on public.shopify_connection_audit from public, anon, authenticated, service_role;
grant select on public.shopify_connection_audit to service_role;

alter table public.shopify_sync_jobs
  add column completed_generation bigint not null default 0,
  add column claimed_generation bigint,
  add column claimed_connection_revision bigint,
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column attempts integer not null default 0,
  add column first_attempt_at timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column last_error_code text,
  add column dead_lettered_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint shopify_job_generations check (completed_generation >= 0 and completed_generation <= requested_generation
    and requested_generation <= 9007199254740991 and (claimed_generation is null or
      (claimed_generation > completed_generation and claimed_generation <= requested_generation))),
  add constraint shopify_job_lease check ((lease_token is null and lease_expires_at is null and claimed_generation is null and claimed_connection_revision is null)
    or (lease_token is not null and lease_expires_at is not null and claimed_generation is not null and claimed_connection_revision is not null)),
  add constraint shopify_job_attempts check (attempts between 0 and 12),
  add constraint shopify_job_error_code check (last_error_code is null or last_error_code in
    ('TRANSIENT', 'THROTTLED', 'AUTH_REQUIRED', 'SCOPE_REQUIRED', 'VALIDATION_REQUIRED', 'RETRY_EXHAUSTED'));
create index shopify_jobs_due on public.shopify_sync_jobs(connection_id, next_attempt_at, requested_at)
  where dead_lettered_at is null;

-- The earlier receipt command predates updated_at. Cover its coalesced request
-- mutation without rewriting that migration or overriding worker timestamps.
create function public.touch_shopify_job_request() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.requested_generation is distinct from old.requested_generation then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;
create trigger shopify_jobs_request_updated before update on public.shopify_sync_jobs
  for each row execute function public.touch_shopify_job_request();
revoke all on function public.touch_shopify_job_request() from public,anon,authenticated;

-- actor_id must come from server-verified Clerk auth, never a browser JSON field.
-- Source identity must come from installed-store verification. This reserves a
-- pending binding only; it cannot attest verification or enable any processing.
create function public.register_shopify_connection(
  p_tenant_id uuid, p_actor_id text, p_request_key uuid, p_shop_gid text,
  p_domain text, p_app_ref text, p_environment text, p_cutoff timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_connection public.shopify_connections%rowtype;
  v_audit public.shopify_connection_audit%rowtype;
  v_fingerprint jsonb;
  v_result jsonb;
begin
  if p_request_key is null or p_actor_id is null or length(p_actor_id) not between 1 and 256
    or p_cutoff is null or not isfinite(p_cutoff) then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  -- Serialize lost-response retries even before a connection row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key::text, 0));
  perform 1 from public.tenants where id = p_tenant_id and status = 'active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_users where tenant_id = p_tenant_id and clerk_user_id = p_actor_id
    and role = 'owner_admin' and status = 'active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  v_fingerprint := jsonb_build_array('register', p_shop_gid, p_domain, p_app_ref, p_environment, extract(epoch from p_cutoff));
  select * into v_audit from public.shopify_connection_audit where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_audit.actor_id is distinct from p_actor_id or v_audit.request_fingerprint is distinct from v_fingerprint then
      raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return v_audit.result;
  end if;
  insert into public.shopify_connections(tenant_id,shop_gid,canonical_domain,app_ref,environment,import_created_at_cutoff)
    values(p_tenant_id,p_shop_gid,p_domain,p_app_ref,p_environment,p_cutoff) returning * into v_connection;
  v_result := jsonb_build_object('connectionId',v_connection.id,'revision',v_connection.revision,'status',v_connection.status);
  insert into public.shopify_connection_audit(tenant_id,connection_id,actor_kind,actor_id,action,reason_code,
    request_key,request_fingerprint,after_revision,after_state,result)
    values(p_tenant_id,v_connection.id,'USER',p_actor_id,'register','OWNER_SETUP',p_request_key,v_fingerprint,v_connection.revision,
      jsonb_build_object('status','pending','intakeEnabled',false,'processingEnabled',false),v_result);
  return v_result;
end $$;

create function public.set_shopify_connection_state(
  p_tenant_id uuid, p_connection_id uuid, p_actor_id text, p_request_key uuid,
  p_expected_revision bigint, p_action text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_connection public.shopify_connections%rowtype;
  v_audit public.shopify_connection_audit%rowtype;
  v_fingerprint jsonb;
  v_result jsonb;
  v_revision bigint;
  v_before jsonb;
begin
  if p_request_key is null or p_actor_id is null or p_action is null or p_action not in ('pause','resume','disconnect')
    or p_expected_revision is null or p_expected_revision <= 0 then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key::text, 0));
  select * into v_connection from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  perform 1 from public.tenant_users where tenant_id=p_tenant_id and clerk_user_id=p_actor_id
    and role='owner_admin' and status='active' for share;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;
  v_fingerprint := jsonb_build_array(p_action,p_connection_id,p_expected_revision);
  select * into v_audit from public.shopify_connection_audit where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if v_audit.actor_id is distinct from p_actor_id or v_audit.request_fingerprint is distinct from v_fingerprint then
      raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT'; end if;
    return v_audit.result;
  end if;
  if v_connection.revision <> p_expected_revision then raise exception 'SHOPIFY_STALE_REVISION'; end if;
  if (p_action='pause' and v_connection.status <> 'verified') or (p_action='resume' and v_connection.status <> 'paused')
    or (p_action='disconnect' and v_connection.status='disconnected') then raise exception 'SHOPIFY_STATE_INVALID'; end if;
  v_revision := v_connection.revision;
  v_before := jsonb_build_object('status',v_connection.status,'intakeEnabled',v_connection.intake_enabled,'processingEnabled',v_connection.processing_enabled);
  update public.shopify_connections set status=case p_action when 'pause' then 'paused' when 'resume' then 'verified' else 'disconnected' end,
    processing_enabled=false, intake_enabled=case when p_action='disconnect' then false else intake_enabled end
    where tenant_id=p_tenant_id and id=p_connection_id returning * into v_connection;
  -- Fencing changes revision; retain requests, never delete audit or dedupe.
  v_result := jsonb_build_object('connectionId',v_connection.id,'revision',v_connection.revision,'status',v_connection.status);
  insert into public.shopify_connection_audit(tenant_id,connection_id,actor_kind,actor_id,action,reason_code,
    request_key,request_fingerprint,before_revision,after_revision,before_state,after_state,result)
    values(p_tenant_id,p_connection_id,'USER',p_actor_id,p_action,'OWNER_' || upper(p_action),p_request_key,
      v_fingerprint,v_revision,v_connection.revision,v_before,
      jsonb_build_object('status',v_connection.status,'intakeEnabled',v_connection.intake_enabled,'processingEnabled',false),v_result);
  return v_result;
end $$;

-- Claim one server-resolved connection. SKIP LOCKED bounds overlapping ticks;
-- all paths acquire connection -> tenant -> job locks, never across HTTP.
create function public.claim_shopify_jobs(p_tenant_id uuid,p_connection_id uuid,p_environment text,p_app_ref text,p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_connection public.shopify_connections%rowtype;
  v_job public.shopify_sync_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_result jsonb := '[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 10 or p_environment is null or p_environment not in ('production','development')
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  select * into v_connection from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id
    and environment=p_environment and app_ref=p_app_ref for update skip locked;
  if not found then return v_result; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found or not v_connection.processing_enabled or not v_connection.intake_enabled or v_connection.status <> 'verified'
    then return v_result; end if;
  -- Evaluate time AFTER any connection/tenant lock waits, not at invocation.
  v_now := clock_timestamp();
  for v_job in select * from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=p_connection_id
    and requested_generation > completed_generation and dead_lettered_at is null and next_attempt_at <= v_now
    and (lease_expires_at is null or lease_expires_at <= v_now)
    order by next_attempt_at,requested_at,id limit p_limit for update skip locked
  loop
    if v_job.attempts >= 12 or v_job.first_attempt_at <= v_now - interval '24 hours' then
      update public.shopify_sync_jobs set dead_lettered_at=v_now,last_error_code='RETRY_EXHAUSTED',
        lease_token=null,lease_expires_at=null,claimed_generation=null,claimed_connection_revision=null,updated_at=v_now
        where tenant_id=p_tenant_id and id=v_job.id;
      continue;
    end if;
    update public.shopify_sync_jobs set lease_token=gen_random_uuid(),lease_expires_at=v_now + interval '120 seconds',
      claimed_generation=requested_generation,claimed_connection_revision=v_connection.revision,attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,v_now),updated_at=v_now
      where tenant_id=p_tenant_id and id=v_job.id returning * into v_job;
    v_result := v_result || jsonb_build_array(jsonb_build_object('jobId',v_job.id,'tenantId',p_tenant_id,
      'connectionId',p_connection_id,'orderGid',v_job.order_gid,'generation',v_job.claimed_generation,
      'connectionRevision',v_connection.revision,'leaseToken',v_job.lease_token,'leaseExpiresAt',v_job.lease_expires_at));
  end loop;
  return v_result;
end $$;

-- No success/complete command exists: the future import transaction must check
-- this fence and commit domain writes + completed generation together.
create function public.update_shopify_job_lease(
  p_tenant_id uuid,p_connection_id uuid,p_environment text,p_app_ref text,p_job_id uuid,
  p_lease_token uuid,p_generation bigint,p_connection_revision bigint,p_action text,p_error_code text,
  p_retry_after_seconds integer default null
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_connection public.shopify_connections%rowtype;
  v_job public.shopify_sync_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_dead boolean;
  v_retry_base integer;
  v_retry_delay integer;
begin
  if p_action is null or p_action not in ('renew','fail') or
    (p_action='renew' and p_error_code is not null) or (p_action='fail' and (p_error_code is null or p_error_code not in
      ('TRANSIENT','THROTTLED','AUTH_REQUIRED','SCOPE_REQUIRED','VALIDATION_REQUIRED')))
    or (p_retry_after_seconds is not null and (p_action <> 'fail' or p_error_code <> 'THROTTLED' or p_retry_after_seconds not between 1 and 86400))
    then raise exception 'SHOPIFY_COMMAND_INVALID'; end if;
  select * into v_connection from public.shopify_connections where tenant_id=p_tenant_id and id=p_connection_id
    and environment=p_environment and app_ref=p_app_ref for update;
  if not found then return false; end if;
  perform 1 from public.tenants where id=p_tenant_id and status='active' for share;
  if not found or v_connection.revision is distinct from p_connection_revision or not v_connection.processing_enabled
    or not v_connection.intake_enabled or v_connection.status <> 'verified' then return false; end if;
  v_now := clock_timestamp();
  select * into v_job from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=p_connection_id
    and id=p_job_id and lease_token=p_lease_token and claimed_generation=p_generation
    and claimed_connection_revision=p_connection_revision and lease_expires_at > v_now and dead_lettered_at is null for update;
  if not found then return false; end if;
  v_now := clock_timestamp();
  if v_job.lease_expires_at <= v_now then return false; end if;
  if p_action='renew' and v_job.first_attempt_at <= v_now-interval '24 hours' then
    update public.shopify_sync_jobs set dead_lettered_at=v_now,last_error_code='RETRY_EXHAUSTED',
      lease_token=null,lease_expires_at=null,claimed_generation=null,claimed_connection_revision=null,updated_at=v_now
      where tenant_id=p_tenant_id and id=p_job_id;
    return false;
  end if;
  if p_action='renew' then
    update public.shopify_sync_jobs set lease_expires_at=v_now+interval '120 seconds',updated_at=v_now where tenant_id=p_tenant_id and id=p_job_id;
    return true;
  end if;
  v_dead := v_job.attempts >= 12 or v_job.first_attempt_at <= v_now-interval '24 hours' or p_error_code='VALIDATION_REQUIRED';
  v_retry_base := case v_job.attempts when 1 then 60 when 2 then 300 when 3 then 900 else 3600 end;
  -- Stable per-job/attempt dispersion (1..20% additive jitter). MD5 is only
  -- a non-secret scheduling hash, not authentication or payload integrity.
  v_retry_delay := v_retry_base + 1 + (get_byte(decode(md5(v_job.id::text || ':' || v_job.attempts::text),'hex'),0)
    + 256 * get_byte(decode(md5(v_job.id::text || ':' || v_job.attempts::text),'hex'),1)) % (v_retry_base / 5);
  update public.shopify_sync_jobs set lease_token=null,lease_expires_at=null,claimed_generation=null,claimed_connection_revision=null,
    last_error_code=p_error_code,dead_lettered_at=case when v_dead then v_now else null end,
    next_attempt_at=v_now + greatest(v_retry_delay,coalesce(p_retry_after_seconds,0))*interval '1 second',updated_at=v_now
    where tenant_id=p_tenant_id and id=p_job_id;
  if p_error_code in ('AUTH_REQUIRED','SCOPE_REQUIRED') then
    update public.shopify_connections set status='paused',processing_enabled=false where tenant_id=p_tenant_id and id=p_connection_id;
    insert into public.shopify_connection_audit(tenant_id,connection_id,actor_kind,action,reason_code,before_revision,after_revision,before_state,after_state,result)
      values(p_tenant_id,p_connection_id,'SYSTEM','auth_pause',p_error_code,v_connection.revision,v_connection.revision+1,
        jsonb_build_object('status',v_connection.status,'intakeEnabled',v_connection.intake_enabled,'processingEnabled',v_connection.processing_enabled),
        jsonb_build_object('status','paused','intakeEnabled',v_connection.intake_enabled,'processingEnabled',false),
        jsonb_build_object('status','paused','jobId',p_job_id));
  end if;
  return true;
end $$;

revoke all on function public.register_shopify_connection(uuid,text,uuid,text,text,text,text,timestamptz),
  public.set_shopify_connection_state(uuid,uuid,text,uuid,bigint,text),
  public.claim_shopify_jobs(uuid,uuid,text,text,integer),
  public.update_shopify_job_lease(uuid,uuid,text,text,uuid,uuid,bigint,bigint,text,text,integer) from public,anon,authenticated;
grant execute on function public.register_shopify_connection(uuid,text,uuid,text,text,text,text,timestamptz),
  public.set_shopify_connection_state(uuid,uuid,text,uuid,bigint,text),
  public.claim_shopify_jobs(uuid,uuid,text,text,integer),
  public.update_shopify_job_lease(uuid,uuid,text,text,uuid,uuid,bigint,bigint,text,text,integer) to service_role;
comment on table public.shopify_sync_jobs is 'Coalesced requests with bounded leases/retries; completion requires a future fenced atomic import command.';
