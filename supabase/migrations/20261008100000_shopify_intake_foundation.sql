-- Additive foundation only. No connection seeds, subscriptions or domain writes.
-- Every table is service-only; an external payload can never choose a tenant.
create table public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shop_gid text not null check (shop_gid ~ '^gid://shopify/Shop/[1-9][0-9]{0,31}$'),
  canonical_domain text not null check (canonical_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'),
  -- PostgreSQL regex repeat bounds stop at 255; keep the 256-byte policy as
  -- an explicit length check rather than an invalid {1,256} repeat bound.
  app_ref text not null check (length(app_ref) between 1 and 256 and app_ref ~ '^[A-Za-z0-9_-]+$'),
  environment text not null check (environment in ('production', 'development')),
  api_version text not null default '2026-10' check (api_version = '2026-10'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'paused', 'disconnected')),
  verified_at timestamptz,
  intake_enabled boolean not null default false,
  import_created_at_cutoff timestamptz not null check (isfinite(import_created_at_cutoff)),
  revision bigint not null default 1 check (revision > 0 and revision <= 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (environment, shop_gid), unique (environment, canonical_domain),
  check (status not in ('verified', 'paused') or verified_at is not null),
  check (not intake_enabled or (status in ('verified', 'paused') and verified_at is not null))
);
create unique index shopify_connections_one_destination_per_tenant
  on public.shopify_connections (tenant_id, environment) where status <> 'disconnected';

create function public.protect_shopify_connection_binding() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.id, new.tenant_id, new.shop_gid, new.app_ref, new.environment, new.import_created_at_cutoff)
     is distinct from
     (old.id, old.tenant_id, old.shop_gid, old.app_ref, old.environment, old.import_created_at_cutoff) then
    raise exception 'SHOPIFY_BINDING_IMMUTABLE';
  end if;
  if old.verified_at is not null and new.verified_at is distinct from old.verified_at then
    raise exception 'SHOPIFY_VERIFICATION_IMMUTABLE';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger shopify_connections_protect_binding before update on public.shopify_connections
  for each row execute function public.protect_shopify_connection_binding();

create table public.shopify_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  delivery_id uuid not null,
  event_id uuid,
  topic text not null check (topic in ('orders/create', 'orders/updated', 'orders/cancelled')),
  api_version text not null check (api_version = '2026-10'),
  order_gid text not null check (order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  triggered_at timestamptz check (triggered_at is null or isfinite(triggered_at)),
  received_at timestamptz not null default now(),
  unique (tenant_id, id), unique (connection_id, delivery_id),
  constraint shopify_receipts_connection_fk foreign key (tenant_id, connection_id) references public.shopify_connections(tenant_id, id) on delete restrict
);
create index shopify_webhook_receipts_received on public.shopify_webhook_receipts (connection_id, received_at);

create table public.shopify_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  order_gid text not null check (order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),
  requested_generation bigint not null default 1 check (requested_generation > 0),
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id), unique (connection_id, order_gid),
  constraint shopify_jobs_connection_fk foreign key (tenant_id, connection_id) references public.shopify_connections(tenant_id, id) on delete restrict
);
-- This slice records requests only. No worker may claim/complete/import them yet.

create table public.shopify_webhook_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  receipt_id uuid not null,
  incoming_body_sha256 text not null check (incoming_body_sha256 ~ '^[0-9a-f]{64}$'),
  incoming_topic text not null check (incoming_topic in ('orders/create', 'orders/updated', 'orders/cancelled')),
  incoming_order_gid text not null check (incoming_order_gid ~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'),
  incoming_api_version text not null check (incoming_api_version = '2026-10'),
  created_at timestamptz not null default now(),
  constraint shopify_conflicts_receipt_fk foreign key (tenant_id, receipt_id) references public.shopify_webhook_receipts(tenant_id, id) on delete restrict,
  unique (receipt_id, incoming_body_sha256, incoming_topic, incoming_order_gid, incoming_api_version)
);

create function public.protect_shopify_intake_audit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'SHOPIFY_RECEIPT_IMMUTABLE';
end;
$$;
create trigger shopify_receipts_immutable before update or delete on public.shopify_webhook_receipts
  for each row execute function public.protect_shopify_intake_audit();
create trigger shopify_conflicts_immutable before update or delete on public.shopify_webhook_conflicts
  for each row execute function public.protect_shopify_intake_audit();

alter table public.shopify_connections enable row level security;
alter table public.shopify_webhook_receipts enable row level security;
alter table public.shopify_sync_jobs enable row level security;
alter table public.shopify_webhook_conflicts enable row level security;
revoke all on public.shopify_connections, public.shopify_webhook_receipts,
  public.shopify_sync_jobs, public.shopify_webhook_conflicts from public, anon, authenticated, service_role;
grant select on public.shopify_connections, public.shopify_webhook_receipts,
  public.shopify_sync_jobs, public.shopify_webhook_conflicts to service_role;
-- Connection setup is not exposed in this slice. Only trusted service setup can
-- write a binding after an authenticated owner and installed store are verified.
grant insert, update on public.shopify_connections to service_role;

create function public.receive_shopify_event(
  p_tenant_id uuid, p_connection_id uuid, p_shop_domain text, p_app_ref text,
  p_environment text, p_expected_revision bigint, p_topic text, p_delivery_id uuid,
  p_event_id uuid, p_api_version text, p_order_gid text, p_body_sha256 text, p_triggered_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_connection public.shopify_connections%rowtype;
  v_receipt public.shopify_webhook_receipts%rowtype;
begin
  if p_tenant_id is null or p_connection_id is null or p_delivery_id is null
     or p_expected_revision is null or p_expected_revision <= 0
     or p_topic is null or p_topic not in ('orders/create', 'orders/updated', 'orders/cancelled')
     or p_api_version is distinct from '2026-10'
     or p_order_gid is null or p_order_gid !~ '^gid://shopify/Order/[1-9][0-9]{0,31}$'
     or p_body_sha256 is null or p_body_sha256 !~ '^[0-9a-f]{64}$'
     or (p_triggered_at is not null and not isfinite(p_triggered_at)) then
    raise exception 'SHOPIFY_ENVELOPE_INVALID';
  end if;
  -- Serialize competing deliveries for this binding. There is no HTTP/API call
  -- under this lock. Future worker commands must follow the same lock ordering.
  select * into v_connection from public.shopify_connections
    where id = p_connection_id and tenant_id = p_tenant_id
      and canonical_domain = p_shop_domain and app_ref = p_app_ref and environment = p_environment
    for update;
  if not found then raise exception 'SHOPIFY_CONNECTION_UNAVAILABLE'; end if;
  perform 1 from public.tenants where id = p_tenant_id and status = 'active' for share;
  if not found then raise exception 'SHOPIFY_TENANT_INACTIVE'; end if;

  select * into v_receipt from public.shopify_webhook_receipts
    where tenant_id = p_tenant_id and connection_id = p_connection_id and delivery_id = p_delivery_id;
  if found then
    if (v_receipt.body_sha256, v_receipt.topic, v_receipt.order_gid, v_receipt.api_version)
       is distinct from (p_body_sha256, p_topic, p_order_gid, p_api_version) then
      insert into public.shopify_webhook_conflicts
        (tenant_id, receipt_id, incoming_body_sha256, incoming_topic, incoming_order_gid, incoming_api_version)
      values (p_tenant_id, v_receipt.id, p_body_sha256, p_topic, p_order_gid, p_api_version)
      on conflict do nothing;
      -- Commit quarantine evidence; never enqueue or overwrite the old receipt.
      return jsonb_build_object('status', 'conflict', 'receiptId', v_receipt.id);
    end if;
    -- Recover committed result before checking mutable enablement/revision.
    return jsonb_build_object('status', 'duplicate', 'receiptId', v_receipt.id);
  end if;
  if not v_connection.intake_enabled or v_connection.status not in ('verified', 'paused')
     or v_connection.verified_at is null or v_connection.api_version <> p_api_version
     or v_connection.revision <> p_expected_revision then
    raise exception 'SHOPIFY_CONNECTION_UNAVAILABLE';
  end if;
  insert into public.shopify_webhook_receipts
    (tenant_id, connection_id, delivery_id, event_id, topic, api_version, order_gid, body_sha256, triggered_at)
  values (p_tenant_id, p_connection_id, p_delivery_id, p_event_id, p_topic, p_api_version, p_order_gid, p_body_sha256, p_triggered_at)
  returning * into v_receipt;
  insert into public.shopify_sync_jobs (tenant_id, connection_id, order_gid)
  values (p_tenant_id, p_connection_id, p_order_gid)
  on conflict (connection_id, order_gid) do update
    set requested_generation = public.shopify_sync_jobs.requested_generation + 1, requested_at = now();
  return jsonb_build_object('status', 'accepted', 'receiptId', v_receipt.id);
end;
$$;
revoke all on function public.receive_shopify_event(uuid,uuid,text,text,text,bigint,text,uuid,uuid,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.receive_shopify_event(uuid,uuid,text,text,text,bigint,text,uuid,uuid,text,text,text,timestamptz)
  to service_role;
revoke all on function public.protect_shopify_connection_binding(), public.protect_shopify_intake_audit()
  from public, anon, authenticated;

comment on table public.shopify_connections is 'Verified immutable tenant/store/cutoff binding. No credentials. Cutover needs a separately reviewed command.';
comment on table public.shopify_webhook_receipts is 'Durable ID/hash-only receipt. Acknowledgement means receipt committed, not order created.';
comment on table public.shopify_sync_jobs is 'Coalesced hydration requests only; workers, leases and order creation are not implemented by this migration.';
