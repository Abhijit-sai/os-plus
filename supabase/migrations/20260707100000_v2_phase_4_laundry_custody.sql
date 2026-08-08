create table qr_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  token text not null,
  entity_type text not null,
  entity_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by text,
  constraint qr_identities_tenant_id_id_unique unique (tenant_id, id),
  constraint qr_identities_token_unique unique (token),
  constraint qr_identities_token_not_blank check (length(btrim(token)) >= 32),
  constraint qr_identities_entity_type_check check (entity_type in ('laundry_container_asset', 'laundry_handling_unit')),
  constraint qr_identities_status_check check (status in ('active', 'revoked', 'rotated'))
);

create index qr_identities_tenant_entity_idx on qr_identities(tenant_id, entity_type, entity_id);
create index qr_identities_tenant_status_idx on qr_identities(tenant_id, status, created_at);

create table laundry_service_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  default_workflow_id uuid not null,
  default_sla_hours integer,
  default_quantity_unit text not null default 'unit',
  allows_weight boolean not null default false,
  allows_piece_count boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint laundry_service_catalog_workflow_tenant_fkey
    foreign key (tenant_id, default_workflow_id)
    references workflows(tenant_id, id)
    on delete restrict,
  constraint laundry_service_catalog_tenant_id_id_unique unique (tenant_id, id),
  constraint laundry_service_catalog_name_not_blank check (length(btrim(name)) > 0),
  constraint laundry_service_catalog_code_not_blank check (length(btrim(code)) > 0),
  constraint laundry_service_catalog_quantity_unit_check check (default_quantity_unit in ('kg', 'piece', 'pair', 'unit', 'sq_ft', 'other')),
  constraint laundry_service_catalog_sla_non_negative check (default_sla_hours is null or default_sla_hours >= 0)
);

create trigger laundry_service_catalog_set_updated_at
before update on laundry_service_catalog
for each row
execute function set_updated_at();

create unique index laundry_service_catalog_tenant_code_active_idx
on laundry_service_catalog(tenant_id, lower(code))
where deleted_at is null;

create index laundry_service_catalog_tenant_active_idx on laundry_service_catalog(tenant_id, is_active, name);

create table laundry_pickup_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null,
  pickup_address_id uuid,
  requested_date date not null,
  requested_window text not null,
  source text not null,
  status text not null default 'NEW',
  assigned_user_id uuid,
  assigned_team_id uuid,
  scheduled_at timestamptz,
  assigned_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint laundry_pickup_requests_customer_tenant_fkey
    foreign key (tenant_id, customer_id)
    references customers(tenant_id, id)
    on delete restrict,
  constraint laundry_pickup_requests_address_tenant_fkey
    foreign key (tenant_id, pickup_address_id)
    references customer_addresses(tenant_id, id)
    on delete restrict,
  constraint laundry_pickup_requests_assigned_user_tenant_fkey
    foreign key (tenant_id, assigned_user_id)
    references tenant_users(tenant_id, id)
    on delete restrict,
  constraint laundry_pickup_requests_assigned_team_tenant_fkey
    foreign key (tenant_id, assigned_team_id)
    references teams(tenant_id, id)
    on delete restrict,
  constraint laundry_pickup_requests_tenant_id_id_unique unique (tenant_id, id),
  constraint laundry_pickup_requests_source_check check (source in ('whatsapp', 'call', 'manual', 'web', 'recurring', 'other')),
  constraint laundry_pickup_requests_status_check check (status in ('NEW', 'SCHEDULED', 'ASSIGNED', 'OUT_FOR_PICKUP', 'PICKED_UP', 'FAILED', 'CANCELLED')),
  constraint laundry_pickup_requests_window_not_blank check (length(btrim(requested_window)) > 0),
  constraint laundry_pickup_requests_assigned_status_has_target check (
    status <> 'ASSIGNED'
    or assigned_user_id is not null
    or assigned_team_id is not null
  )
);

create trigger laundry_pickup_requests_set_updated_at
before update on laundry_pickup_requests
for each row
execute function set_updated_at();

create index laundry_pickup_requests_tenant_status_date_idx on laundry_pickup_requests(tenant_id, status, requested_date);
create index laundry_pickup_requests_tenant_customer_idx on laundry_pickup_requests(tenant_id, customer_id, requested_date);
create index laundry_pickup_requests_tenant_assigned_user_idx on laundry_pickup_requests(tenant_id, assigned_user_id, status);
create index laundry_pickup_requests_tenant_assigned_team_idx on laundry_pickup_requests(tenant_id, assigned_team_id, status);

create table laundry_container_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  container_code text not null,
  qr_identity_id uuid,
  container_type text not null default 'bag',
  assigned_customer_id uuid,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint laundry_container_assets_qr_tenant_fkey
    foreign key (tenant_id, qr_identity_id)
    references qr_identities(tenant_id, id)
    on delete restrict,
  constraint laundry_container_assets_customer_tenant_fkey
    foreign key (tenant_id, assigned_customer_id)
    references customers(tenant_id, id)
    on delete restrict,
  constraint laundry_container_assets_tenant_id_id_unique unique (tenant_id, id),
  constraint laundry_container_assets_code_not_blank check (length(btrim(container_code)) > 0),
  constraint laundry_container_assets_type_check check (container_type in ('bag', 'cover', 'box', 'other')),
  constraint laundry_container_assets_status_check check (status in ('active', 'lost', 'maintenance', 'retired'))
);

create trigger laundry_container_assets_set_updated_at
before update on laundry_container_assets
for each row
execute function set_updated_at();

create unique index laundry_container_assets_tenant_code_active_idx
on laundry_container_assets(tenant_id, lower(container_code))
where deleted_at is null;

create unique index laundry_container_assets_tenant_qr_idx
on laundry_container_assets(tenant_id, qr_identity_id)
where qr_identity_id is not null;

create index laundry_container_assets_tenant_customer_idx on laundry_container_assets(tenant_id, assigned_customer_id, status);
create index laundry_container_assets_tenant_status_idx on laundry_container_assets(tenant_id, status, container_type);

create table laundry_handling_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  handling_unit_code text not null,
  qr_identity_id uuid,
  container_asset_id uuid,
  customer_id uuid not null,
  order_id uuid,
  handling_unit_type text not null default 'bag',
  current_location_id uuid,
  custody_status text not null default 'EXPECTED',
  created_from_pickup_id uuid,
  created_from_collection_batch_id uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint laundry_handling_units_qr_tenant_fkey
    foreign key (tenant_id, qr_identity_id)
    references qr_identities(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_container_asset_tenant_fkey
    foreign key (tenant_id, container_asset_id)
    references laundry_container_assets(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_customer_tenant_fkey
    foreign key (tenant_id, customer_id)
    references customers(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_order_tenant_fkey
    foreign key (tenant_id, order_id)
    references orders(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_location_tenant_fkey
    foreign key (tenant_id, current_location_id)
    references tenant_locations(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_pickup_tenant_fkey
    foreign key (tenant_id, created_from_pickup_id)
    references laundry_pickup_requests(tenant_id, id)
    on delete restrict,
  constraint laundry_handling_units_tenant_id_id_unique unique (tenant_id, id),
  constraint laundry_handling_units_code_not_blank check (length(btrim(handling_unit_code)) > 0),
  constraint laundry_handling_units_type_check check (handling_unit_type in ('bag', 'cover', 'shoe_packet', 'carpet', 'curtain_bundle', 'other')),
  constraint laundry_handling_units_status_check check (
    custody_status in (
      'EXPECTED',
      'IN_CUSTOMER_POSSESSION',
      'PICKED_UP',
      'AT_STORE',
      'IN_TRANSFER',
      'AT_WORKSHOP',
      'IN_PRODUCTION',
      'READY',
      'OUT_FOR_FULFILMENT',
      'RETURNED_TO_CUSTOMER',
      'CLOSED',
      'EXCEPTION'
    )
  )
);

create trigger laundry_handling_units_set_updated_at
before update on laundry_handling_units
for each row
execute function set_updated_at();

create unique index laundry_handling_units_tenant_code_active_idx
on laundry_handling_units(tenant_id, lower(handling_unit_code))
where deleted_at is null;

create unique index laundry_handling_units_tenant_qr_idx
on laundry_handling_units(tenant_id, qr_identity_id)
where qr_identity_id is not null;

create index laundry_handling_units_tenant_customer_idx on laundry_handling_units(tenant_id, customer_id, custody_status);
create index laundry_handling_units_tenant_order_idx on laundry_handling_units(tenant_id, order_id);
create index laundry_handling_units_tenant_location_idx on laundry_handling_units(tenant_id, current_location_id, custody_status);
create index laundry_handling_units_tenant_pickup_idx on laundry_handling_units(tenant_id, created_from_pickup_id);
create index laundry_handling_units_tenant_container_idx on laundry_handling_units(tenant_id, container_asset_id);

create table laundry_custody_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  handling_unit_id uuid not null,
  event_type text not null,
  from_location_id uuid,
  to_location_id uuid,
  from_custody_type text,
  from_custody_id uuid,
  to_custody_type text,
  to_custody_id uuid,
  manifest_id uuid,
  actor_type text not null,
  actor_id text,
  source text not null,
  notes text,
  payload_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint laundry_custody_events_handling_unit_tenant_fkey
    foreign key (tenant_id, handling_unit_id)
    references laundry_handling_units(tenant_id, id)
    on delete cascade,
  constraint laundry_custody_events_from_location_tenant_fkey
    foreign key (tenant_id, from_location_id)
    references tenant_locations(tenant_id, id)
    on delete restrict,
  constraint laundry_custody_events_to_location_tenant_fkey
    foreign key (tenant_id, to_location_id)
    references tenant_locations(tenant_id, id)
    on delete restrict,
  constraint laundry_custody_events_type_check check (
    event_type in (
      'custody_established',
      'picked_up',
      'received_at_location',
      'dispatched_in_manifest',
      'received_from_manifest',
      'out_for_fulfilment',
      'returned_to_customer',
      'exception_recorded'
    )
  ),
  constraint laundry_custody_events_actor_type_check check (actor_type in ('USER', 'SYSTEM', 'AGENT', 'WEBHOOK')),
  constraint laundry_custody_events_source_check check (source in ('OS_PLUS_UI', 'QR_SCAN', 'WHATSAPP', 'TELEGRAM', 'API', 'WEBHOOK', 'AUTOMATION'))
);

create index laundry_custody_events_tenant_unit_idx on laundry_custody_events(tenant_id, handling_unit_id, occurred_at);
create index laundry_custody_events_tenant_type_idx on laundry_custody_events(tenant_id, event_type, occurred_at);

create table laundry_service_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  work_unit_id uuid not null,
  handling_unit_id uuid not null,
  order_line_id uuid not null,
  service_catalog_id uuid not null,
  quantity numeric(12, 3) not null default 1,
  quantity_unit text not null default 'unit',
  piece_count integer,
  weight_kg numeric(12, 3),
  special_instructions text,
  intake_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint laundry_service_lots_work_unit_tenant_fkey
    foreign key (tenant_id, work_unit_id)
    references work_units(tenant_id, id)
    on delete restrict,
  constraint laundry_service_lots_handling_unit_tenant_fkey
    foreign key (tenant_id, handling_unit_id)
    references laundry_handling_units(tenant_id, id)
    on delete restrict,
  constraint laundry_service_lots_order_line_tenant_fkey
    foreign key (tenant_id, order_line_id)
    references order_lines(tenant_id, id)
    on delete restrict,
  constraint laundry_service_lots_service_catalog_tenant_fkey
    foreign key (tenant_id, service_catalog_id)
    references laundry_service_catalog(tenant_id, id)
    on delete restrict,
  constraint laundry_service_lots_tenant_id_id_unique unique (tenant_id, id),
  constraint laundry_service_lots_quantity_positive check (quantity > 0),
  constraint laundry_service_lots_quantity_unit_check check (quantity_unit in ('kg', 'piece', 'pair', 'unit', 'sq_ft', 'other')),
  constraint laundry_service_lots_piece_count_non_negative check (piece_count is null or piece_count >= 0),
  constraint laundry_service_lots_weight_non_negative check (weight_kg is null or weight_kg >= 0)
);

create trigger laundry_service_lots_set_updated_at
before update on laundry_service_lots
for each row
execute function set_updated_at();

create unique index laundry_service_lots_tenant_work_unit_active_idx
on laundry_service_lots(tenant_id, work_unit_id)
where deleted_at is null;

create index laundry_service_lots_tenant_handling_unit_idx on laundry_service_lots(tenant_id, handling_unit_id);
create index laundry_service_lots_tenant_order_line_idx on laundry_service_lots(tenant_id, order_line_id);
create index laundry_service_lots_tenant_service_idx on laundry_service_lots(tenant_id, service_catalog_id);

alter table qr_identities enable row level security;
alter table laundry_service_catalog enable row level security;
alter table laundry_pickup_requests enable row level security;
alter table laundry_container_assets enable row level security;
alter table laundry_handling_units enable row level security;
alter table laundry_custody_events enable row level security;
alter table laundry_service_lots enable row level security;

create or replace function prevent_laundry_custody_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'LAUNDRY_CUSTODY_EVENTS_ARE_APPEND_ONLY'
    using errcode = 'P0001';
end;
$$;

create trigger laundry_custody_events_append_only_update
before update on laundry_custody_events
for each row
execute function prevent_laundry_custody_event_mutation();

create trigger laundry_custody_events_append_only_delete
before delete on laundry_custody_events
for each row
execute function prevent_laundry_custody_event_mutation();

create or replace function assert_laundry_vertical_enabled(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from tenant_verticals
  inner join vertical_definitions
    on vertical_definitions.id = tenant_verticals.vertical_definition_id
  where tenant_verticals.tenant_id = p_tenant_id
    and tenant_verticals.is_enabled = true
    and vertical_definitions.key = 'laundry'
    and vertical_definitions.is_active = true;

  if not found then
    raise exception 'TENANT_LAUNDRY_VERTICAL_NOT_ENABLED'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function generate_laundry_human_code(
  p_tenant_id uuid,
  p_prefix text,
  p_table_name text,
  p_column_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := upper(p_prefix || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    execute format(
      'select exists (select 1 from %I where tenant_id = $1 and lower(%I) = lower($2) and deleted_at is null)',
      p_table_name,
      p_column_name
    )
    into v_exists
    using p_tenant_id, v_code;

    exit when not v_exists;
  end loop;

  return v_code;
end;
$$;

create or replace function generate_qr_identity_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  loop
    v_token := encode(gen_random_bytes(24), 'hex');
    exit when not exists (
      select 1
      from qr_identities
      where token = v_token
    );
  end loop;

  return v_token;
end;
$$;

create or replace function create_laundry_pickup_request_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_customer_id uuid,
  p_pickup_address_id uuid,
  p_requested_date date,
  p_requested_window text,
  p_pickup_source text,
  p_assigned_user_id uuid default null,
  p_assigned_team_id uuid default null,
  p_scheduled_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CreateLaundryPickupRequest';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_pickup_id uuid;
  v_pickup_status text;
  v_event_id uuid;
  v_task_result jsonb;
  v_result jsonb;
begin
  perform assert_laundry_vertical_enabled(p_tenant_id);

  v_request := jsonb_build_object(
    'customer_id', p_customer_id,
    'pickup_address_id', p_pickup_address_id,
    'requested_date', p_requested_date,
    'requested_window', p_requested_window,
    'pickup_source', p_pickup_source,
    'assigned_user_id', p_assigned_user_id,
    'assigned_team_id', p_assigned_team_id,
    'scheduled_at', p_scheduled_at,
    'notes', p_notes
  );
  v_request_hash := md5(v_request::text);

  if p_idempotency_key is not null then
    select * into v_existing
    from command_idempotency
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key
    for update;

    if found then
      if v_existing.request_hash <> v_request_hash then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          using errcode = 'P0001';
      end if;

      if v_existing.status = 'completed' then
        return v_existing.result_json;
      end if;

      raise exception 'COMMAND_ALREADY_PROCESSING'
        using errcode = 'P0001';
    end if;

    insert into command_idempotency (tenant_id, command_type, idempotency_key, request_hash, status)
    values (p_tenant_id, v_command_type, p_idempotency_key, v_request_hash, 'processing');
  end if;

  perform 1 from customers where tenant_id = p_tenant_id and id = p_customer_id and deleted_at is null;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if p_pickup_address_id is not null then
    perform 1
    from customer_addresses
    where tenant_id = p_tenant_id
      and customer_id = p_customer_id
      and id = p_pickup_address_id
      and deleted_at is null;

    if not found then
      raise exception 'PICKUP_ADDRESS_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_assigned_user_id is not null then
    perform 1 from tenant_users where tenant_id = p_tenant_id and id = p_assigned_user_id and status = 'active';
    if not found then
      raise exception 'ASSIGNED_USER_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_assigned_team_id is not null then
    perform 1 from teams where tenant_id = p_tenant_id and id = p_assigned_team_id and is_active = true and deleted_at is null;
    if not found then
      raise exception 'ASSIGNED_TEAM_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  v_pickup_status := case
    when p_assigned_user_id is not null or p_assigned_team_id is not null then 'ASSIGNED'
    when p_scheduled_at is not null then 'SCHEDULED'
    else 'NEW'
  end;

  insert into laundry_pickup_requests (
    tenant_id,
    customer_id,
    pickup_address_id,
    requested_date,
    requested_window,
    source,
    status,
    assigned_user_id,
    assigned_team_id,
    scheduled_at,
    assigned_at,
    notes,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_customer_id,
    p_pickup_address_id,
    p_requested_date,
    p_requested_window,
    p_pickup_source,
    v_pickup_status,
    p_assigned_user_id,
    p_assigned_team_id,
    p_scheduled_at,
    case when v_pickup_status = 'ASSIGNED' then now() else null end,
    p_notes,
    p_actor_id,
    p_actor_id
  )
  returning id into v_pickup_id;

  insert into domain_events (
    tenant_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor_type,
    actor_id,
    source,
    correlation_id,
    payload_json
  )
  values (
    p_tenant_id,
    'pickup.requested',
    'laundry_pickup_request',
    v_pickup_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_request || jsonb_build_object('status', v_pickup_status)
  )
  returning id into v_event_id;

  select create_task_command(
    p_tenant_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    null,
    'PICKUP',
    'Pickup request',
    p_notes,
    'pickup_request',
    v_pickup_id,
    p_assigned_user_id,
    p_assigned_team_id,
    'NORMAL',
    p_scheduled_at,
    v_event_id
  )
  into v_task_result;

  v_result := jsonb_build_object(
    'pickup_request_id', v_pickup_id,
    'task_id', v_task_result->>'task_id',
    'status', v_pickup_status,
    'event_ids', jsonb_build_array(v_event_id) || coalesce(v_task_result->'event_ids', '[]'::jsonb)
  );

  if p_idempotency_key is not null then
    update command_idempotency
    set status = 'completed', result_json = v_result, completed_at = now()
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_result;
end;
$$;

create or replace function create_laundry_container_asset_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_container_code text default null,
  p_container_type text default 'bag',
  p_assigned_customer_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CreateLaundryContainerAsset';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_container_id uuid;
  v_qr_identity_id uuid;
  v_token text;
  v_container_code text;
  v_event_id uuid;
  v_result jsonb;
begin
  perform assert_laundry_vertical_enabled(p_tenant_id);

  v_container_code := nullif(btrim(coalesce(p_container_code, '')), '');
  if v_container_code is null then
    v_container_code := generate_laundry_human_code(p_tenant_id, case when p_container_type = 'bag' then 'BAG' else 'CON' end, 'laundry_container_assets', 'container_code');
  end if;

  v_request := jsonb_build_object(
    'container_code', v_container_code,
    'container_type', p_container_type,
    'assigned_customer_id', p_assigned_customer_id,
    'notes', p_notes
  );
  v_request_hash := md5(v_request::text);

  if p_idempotency_key is not null then
    select * into v_existing
    from command_idempotency
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key
    for update;

    if found then
      if v_existing.request_hash <> v_request_hash then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          using errcode = 'P0001';
      end if;

      if v_existing.status = 'completed' then
        return v_existing.result_json;
      end if;

      raise exception 'COMMAND_ALREADY_PROCESSING'
        using errcode = 'P0001';
    end if;

    insert into command_idempotency (tenant_id, command_type, idempotency_key, request_hash, status)
    values (p_tenant_id, v_command_type, p_idempotency_key, v_request_hash, 'processing');
  end if;

  if p_assigned_customer_id is not null then
    perform 1 from customers where tenant_id = p_tenant_id and id = p_assigned_customer_id and deleted_at is null;
    if not found then
      raise exception 'CUSTOMER_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  insert into laundry_container_assets (
    tenant_id,
    container_code,
    container_type,
    assigned_customer_id,
    notes,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    v_container_code,
    p_container_type,
    p_assigned_customer_id,
    p_notes,
    p_actor_id,
    p_actor_id
  )
  returning id into v_container_id;

  v_token := generate_qr_identity_token();

  insert into qr_identities (
    tenant_id,
    token,
    entity_type,
    entity_id,
    created_by
  )
  values (
    p_tenant_id,
    v_token,
    'laundry_container_asset',
    v_container_id,
    p_actor_id
  )
  returning id into v_qr_identity_id;

  update laundry_container_assets
  set qr_identity_id = v_qr_identity_id, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_container_id;

  insert into domain_events (
    tenant_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor_type,
    actor_id,
    source,
    correlation_id,
    payload_json
  )
  values (
    p_tenant_id,
    'container_asset.created',
    'laundry_container_asset',
    v_container_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_request || jsonb_build_object('qr_identity_id', v_qr_identity_id)
  )
  returning id into v_event_id;

  v_result := jsonb_build_object(
    'container_asset_id', v_container_id,
    'qr_identity_id', v_qr_identity_id,
    'container_code', v_container_code,
    'qr_token', v_token,
    'event_ids', jsonb_build_array(v_event_id)
  );

  if p_idempotency_key is not null then
    update command_idempotency
    set status = 'completed', result_json = v_result, completed_at = now()
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_result;
end;
$$;

create or replace function complete_laundry_pickup_request_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_pickup_request_id uuid,
  p_handling_unit_type text default 'bag',
  p_current_location_id uuid default null,
  p_container_asset_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CompleteLaundryPickupRequest';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_pickup laundry_pickup_requests%rowtype;
  v_container laundry_container_assets%rowtype;
  v_handling_unit_id uuid;
  v_handling_unit_code text;
  v_qr_identity_id uuid;
  v_token text;
  v_pickup_event_id uuid;
  v_handling_event_id uuid;
  v_custody_event_id uuid;
  v_task_result jsonb;
  v_result jsonb;
  v_now timestamptz := now();
begin
  perform assert_laundry_vertical_enabled(p_tenant_id);

  v_request := jsonb_build_object(
    'pickup_request_id', p_pickup_request_id,
    'handling_unit_type', p_handling_unit_type,
    'current_location_id', p_current_location_id,
    'container_asset_id', p_container_asset_id,
    'notes', p_notes
  );
  v_request_hash := md5(v_request::text);

  if p_idempotency_key is not null then
    select * into v_existing
    from command_idempotency
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key
    for update;

    if found then
      if v_existing.request_hash <> v_request_hash then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          using errcode = 'P0001';
      end if;

      if v_existing.status = 'completed' then
        return v_existing.result_json;
      end if;

      raise exception 'COMMAND_ALREADY_PROCESSING'
        using errcode = 'P0001';
    end if;

    insert into command_idempotency (tenant_id, command_type, idempotency_key, request_hash, status)
    values (p_tenant_id, v_command_type, p_idempotency_key, v_request_hash, 'processing');
  end if;

  select *
  into v_pickup
  from laundry_pickup_requests
  where tenant_id = p_tenant_id
    and id = p_pickup_request_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'PICKUP_REQUEST_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_pickup.status in ('PICKED_UP', 'FAILED', 'CANCELLED') then
    raise exception 'PICKUP_REQUEST_NOT_COMPLETABLE'
      using errcode = 'P0001';
  end if;

  if p_current_location_id is not null then
    perform 1
    from tenant_locations
    where tenant_id = p_tenant_id
      and id = p_current_location_id
      and is_active = true
      and deleted_at is null;

    if not found then
      raise exception 'LOCATION_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_container_asset_id is not null then
    select *
    into v_container
    from laundry_container_assets
    where tenant_id = p_tenant_id
      and id = p_container_asset_id
      and status = 'active'
      and deleted_at is null
    for update;

    if not found then
      raise exception 'CONTAINER_ASSET_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  v_handling_unit_code := generate_laundry_human_code(p_tenant_id, 'HU', 'laundry_handling_units', 'handling_unit_code');

  insert into laundry_handling_units (
    tenant_id,
    handling_unit_code,
    container_asset_id,
    customer_id,
    handling_unit_type,
    current_location_id,
    custody_status,
    created_from_pickup_id,
    opened_at,
    notes,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    v_handling_unit_code,
    p_container_asset_id,
    v_pickup.customer_id,
    p_handling_unit_type,
    p_current_location_id,
    case when p_current_location_id is null then 'PICKED_UP' else 'AT_STORE' end,
    p_pickup_request_id,
    v_now,
    p_notes,
    p_actor_id,
    p_actor_id
  )
  returning id into v_handling_unit_id;

  v_token := generate_qr_identity_token();

  insert into qr_identities (
    tenant_id,
    token,
    entity_type,
    entity_id,
    created_by
  )
  values (
    p_tenant_id,
    v_token,
    'laundry_handling_unit',
    v_handling_unit_id,
    p_actor_id
  )
  returning id into v_qr_identity_id;

  update laundry_handling_units
  set qr_identity_id = v_qr_identity_id, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_handling_unit_id;

  update laundry_pickup_requests
  set status = 'PICKED_UP', completed_at = v_now, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = p_pickup_request_id;

  insert into laundry_custody_events (
    tenant_id,
    handling_unit_id,
    event_type,
    to_location_id,
    from_custody_type,
    to_custody_type,
    actor_type,
    actor_id,
    source,
    notes,
    payload_json,
    occurred_at
  )
  values (
    p_tenant_id,
    v_handling_unit_id,
    'picked_up',
    p_current_location_id,
    'customer',
    'tenant',
    p_actor_type,
    p_actor_id,
    p_source,
    p_notes,
    jsonb_build_object('pickup_request_id', p_pickup_request_id, 'container_asset_id', p_container_asset_id),
    v_now
  )
  returning id into v_custody_event_id;

  insert into domain_events (
    tenant_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor_type,
    actor_id,
    source,
    correlation_id,
    payload_json
  )
  values (
    p_tenant_id,
    'pickup.completed',
    'laundry_pickup_request',
    p_pickup_request_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_request || jsonb_build_object('handling_unit_id', v_handling_unit_id)
  )
  returning id into v_pickup_event_id;

  insert into domain_events (
    tenant_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor_type,
    actor_id,
    source,
    correlation_id,
    causation_event_id,
    payload_json
  )
  values (
    p_tenant_id,
    'handling_unit.created',
    'laundry_handling_unit',
    v_handling_unit_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_pickup_event_id,
    jsonb_build_object(
      'pickup_request_id', p_pickup_request_id,
      'handling_unit_code', v_handling_unit_code,
      'qr_identity_id', v_qr_identity_id,
      'custody_event_id', v_custody_event_id
    )
  )
  returning id into v_handling_event_id;

  select create_task_command(
    p_tenant_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    null,
    'VERIFY_INTAKE',
    'Verify intake',
    p_notes,
    'handling_unit',
    v_handling_unit_id,
    null,
    null,
    'NORMAL',
    null,
    v_handling_event_id
  )
  into v_task_result;

  v_result := jsonb_build_object(
    'pickup_request_id', p_pickup_request_id,
    'handling_unit_id', v_handling_unit_id,
    'handling_unit_code', v_handling_unit_code,
    'qr_identity_id', v_qr_identity_id,
    'qr_token', v_token,
    'custody_event_id', v_custody_event_id,
    'intake_task_id', v_task_result->>'task_id',
    'event_ids', jsonb_build_array(v_pickup_event_id, v_handling_event_id) || coalesce(v_task_result->'event_ids', '[]'::jsonb)
  );

  if p_idempotency_key is not null then
    update command_idempotency
    set status = 'completed', result_json = v_result, completed_at = now()
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_result;
end;
$$;

create or replace function create_laundry_service_lot_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_handling_unit_id uuid,
  p_order_id uuid,
  p_service_catalog_id uuid,
  p_quantity numeric default 1,
  p_quantity_unit text default null,
  p_piece_count integer default null,
  p_weight_kg numeric default null,
  p_special_instructions text default null,
  p_display_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CreateLaundryServiceLot';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_handling_unit laundry_handling_units%rowtype;
  v_service laundry_service_catalog%rowtype;
  v_order orders%rowtype;
  v_order_line_id uuid;
  v_work_unit_id uuid;
  v_workflow_instance_id uuid;
  v_service_lot_id uuid;
  v_sort_order integer;
  v_display_code text;
  v_quantity_unit text;
  v_event_id uuid;
  v_result jsonb;
begin
  perform assert_laundry_vertical_enabled(p_tenant_id);

  v_display_code := nullif(btrim(coalesce(p_display_code, '')), '');
  v_quantity_unit := coalesce(nullif(btrim(coalesce(p_quantity_unit, '')), ''), 'unit');

  v_request := jsonb_build_object(
    'handling_unit_id', p_handling_unit_id,
    'order_id', p_order_id,
    'service_catalog_id', p_service_catalog_id,
    'quantity', p_quantity,
    'quantity_unit', v_quantity_unit,
    'piece_count', p_piece_count,
    'weight_kg', p_weight_kg,
    'special_instructions', p_special_instructions,
    'display_code', v_display_code
  );
  v_request_hash := md5(v_request::text);

  if p_idempotency_key is not null then
    select * into v_existing
    from command_idempotency
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key
    for update;

    if found then
      if v_existing.request_hash <> v_request_hash then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          using errcode = 'P0001';
      end if;

      if v_existing.status = 'completed' then
        return v_existing.result_json;
      end if;

      raise exception 'COMMAND_ALREADY_PROCESSING'
        using errcode = 'P0001';
    end if;

    insert into command_idempotency (tenant_id, command_type, idempotency_key, request_hash, status)
    values (p_tenant_id, v_command_type, p_idempotency_key, v_request_hash, 'processing');
  end if;

  select *
  into v_handling_unit
  from laundry_handling_units
  where tenant_id = p_tenant_id
    and id = p_handling_unit_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'HANDLING_UNIT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  select *
  into v_order
  from orders
  where tenant_id = p_tenant_id
    and id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_order.runtime_model <> 'work_unit_v2' or v_order.vertical_key <> 'laundry' then
    raise exception 'ORDER_NOT_LAUNDRY_WORK_UNIT_RUNTIME'
      using errcode = 'P0001';
  end if;

  if v_order.customer_id <> v_handling_unit.customer_id then
    raise exception 'ORDER_CUSTOMER_MISMATCH'
      using errcode = 'P0001';
  end if;

  select *
  into v_service
  from laundry_service_catalog
  where tenant_id = p_tenant_id
    and id = p_service_catalog_id
    and is_active = true
    and deleted_at is null;

  if not found then
    raise exception 'LAUNDRY_SERVICE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  perform 1
  from workflows
  where tenant_id = p_tenant_id
    and id = v_service.default_workflow_id
    and is_active = true
    and deleted_at is null;

  if not found then
    raise exception 'WORKFLOW_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_display_code is null then
    v_display_code := v_handling_unit.handling_unit_code || '-' || upper(v_service.code);
  end if;

  select coalesce(max(sort_order), 0) + 1
  into v_sort_order
  from order_lines
  where tenant_id = p_tenant_id
    and order_id = p_order_id
    and deleted_at is null;

  insert into order_lines (
    tenant_id,
    order_id,
    line_type,
    name,
    description,
    quantity,
    quantity_unit,
    unit_price,
    discount_amount,
    gst_treatment,
    gst_rate,
    estimated_amount,
    source_vertical_key,
    source_object_type,
    sort_order,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_order_id,
    'service',
    v_service.name,
    p_special_instructions,
    p_quantity,
    v_quantity_unit,
    0,
    0,
    'not_applicable',
    0,
    0,
    'laundry',
    'laundry_service_lot',
    v_sort_order,
    p_actor_id,
    p_actor_id
  )
  returning id into v_order_line_id;

  insert into work_units (
    tenant_id,
    order_id,
    order_line_id,
    vertical_key,
    vertical_object_type,
    display_code,
    workflow_id,
    current_location_id,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_order_id,
    v_order_line_id,
    'laundry',
    'laundry_service_lot',
    v_display_code,
    v_service.default_workflow_id,
    v_handling_unit.current_location_id,
    'not_started',
    p_actor_id,
    p_actor_id
  )
  returning id into v_work_unit_id;

  select initialize_work_unit_workflow(p_tenant_id, v_work_unit_id, p_actor_id)
  into v_workflow_instance_id;

  insert into laundry_service_lots (
    tenant_id,
    work_unit_id,
    handling_unit_id,
    order_line_id,
    service_catalog_id,
    quantity,
    quantity_unit,
    piece_count,
    weight_kg,
    special_instructions,
    intake_verified_at,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    v_work_unit_id,
    p_handling_unit_id,
    v_order_line_id,
    p_service_catalog_id,
    p_quantity,
    v_quantity_unit,
    p_piece_count,
    p_weight_kg,
    p_special_instructions,
    now(),
    p_actor_id,
    p_actor_id
  )
  returning id into v_service_lot_id;

  update order_lines
  set source_object_id = v_service_lot_id, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_order_line_id;

  update work_units
  set vertical_object_id = v_service_lot_id, updated_by = p_actor_id
  where tenant_id = p_tenant_id and id = v_work_unit_id;

  if v_handling_unit.order_id is null then
    update laundry_handling_units
    set order_id = p_order_id, updated_by = p_actor_id
    where tenant_id = p_tenant_id and id = p_handling_unit_id;
  end if;

  insert into domain_events (
    tenant_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor_type,
    actor_id,
    source,
    correlation_id,
    payload_json
  )
  values (
    p_tenant_id,
    'service_lot.created',
    'laundry_service_lot',
    v_service_lot_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_request || jsonb_build_object(
      'order_line_id', v_order_line_id,
      'work_unit_id', v_work_unit_id,
      'workflow_instance_id', v_workflow_instance_id
    )
  )
  returning id into v_event_id;

  v_result := jsonb_build_object(
    'service_lot_id', v_service_lot_id,
    'order_line_id', v_order_line_id,
    'work_unit_id', v_work_unit_id,
    'workflow_instance_id', v_workflow_instance_id,
    'display_code', v_display_code,
    'event_ids', jsonb_build_array(v_event_id)
  );

  if p_idempotency_key is not null then
    update command_idempotency
    set status = 'completed', result_json = v_result, completed_at = now()
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_result;
end;
$$;

comment on table qr_identities is 'Tenant-owned opaque QR identity registry. Tokens identify entities only; scan mutations are added in V2-5.';
comment on table laundry_service_catalog is 'Tenant-owned Laundry service definitions mapped to configurable Work Unit workflows.';
comment on table laundry_pickup_requests is 'Tenant-owned Laundry pickup demand records.';
comment on table laundry_container_assets is 'Reusable Laundry container assets such as permanent hostel bags.';
comment on table laundry_handling_units is 'One physical Laundry custody cycle for a bag, cover, shoe packet, carpet or bundle.';
comment on table laundry_custody_events is 'Append-only custody event history for Laundry Handling Units.';
comment on table laundry_service_lots is 'Laundry service-specific operational lot linked one-to-one to a V2 Work Unit in launch scope.';
comment on function create_laundry_pickup_request_command(uuid, text, text, text, text, text, uuid, uuid, date, text, text, uuid, uuid, timestamptz, text)
is 'Atomically creates a Laundry pickup request, pickup task, domain events and optional idempotency result.';
comment on function create_laundry_container_asset_command(uuid, text, text, text, text, text, text, text, uuid, text)
is 'Atomically creates a reusable Laundry container asset with opaque QR identity, domain event and optional idempotency result.';
comment on function complete_laundry_pickup_request_command(uuid, text, text, text, text, text, uuid, text, uuid, uuid, text)
is 'Atomically completes a Laundry pickup, creates a Handling Unit, QR identity, custody event, intake task, domain events and optional idempotency result.';
comment on function create_laundry_service_lot_command(uuid, text, text, text, text, text, uuid, uuid, uuid, numeric, text, integer, numeric, text, text)
is 'Atomically creates a Laundry Service Lot, Order Line, Work Unit workflow runtime, domain event and optional idempotency result.';
