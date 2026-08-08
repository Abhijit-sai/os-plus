do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenant_users_tenant_id_id_unique'
  ) then
    alter table public.tenant_users
      add constraint tenant_users_tenant_id_id_unique unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'teams_tenant_id_id_unique'
  ) then
    alter table public.teams
      add constraint teams_tenant_id_id_unique unique (tenant_id, id);
  end if;
end $$;

create table command_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  command_type text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing',
  result_json jsonb,
  error_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint command_idempotency_status_check check (status in ('processing', 'completed', 'failed')),
  constraint command_idempotency_command_type_not_blank check (length(btrim(command_type)) > 0),
  constraint command_idempotency_key_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint command_idempotency_tenant_command_key_unique unique (tenant_id, command_type, idempotency_key)
);

create index command_idempotency_tenant_status_idx on command_idempotency(tenant_id, status, created_at);

create table domain_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_type text not null,
  actor_id text,
  source text not null,
  correlation_id text not null,
  causation_event_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint domain_events_tenant_id_id_unique unique (tenant_id, id),
  constraint domain_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint domain_events_aggregate_type_not_blank check (length(btrim(aggregate_type)) > 0),
  constraint domain_events_actor_type_check check (actor_type in ('USER', 'SYSTEM', 'AGENT', 'WEBHOOK')),
  constraint domain_events_source_check check (source in ('OS_PLUS_UI', 'QR_SCAN', 'WHATSAPP', 'TELEGRAM', 'API', 'WEBHOOK', 'AUTOMATION')),
  constraint domain_events_correlation_not_blank check (length(btrim(correlation_id)) > 0),
  constraint domain_events_causation_tenant_fkey
    foreign key (tenant_id, causation_event_id)
    references domain_events(tenant_id, id)
    on delete restrict
);

create index domain_events_tenant_occurred_idx on domain_events(tenant_id, occurred_at);
create index domain_events_tenant_type_occurred_idx on domain_events(tenant_id, event_type, occurred_at);
create index domain_events_tenant_aggregate_idx on domain_events(tenant_id, aggregate_type, aggregate_id, occurred_at);
create index domain_events_correlation_idx on domain_events(correlation_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_type text not null,
  title text not null,
  description text,
  subject_type text not null,
  subject_id uuid not null,
  assigned_user_id uuid,
  assigned_team_id uuid,
  priority text not null default 'NORMAL',
  status text not null default 'OPEN',
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  source text not null,
  source_event_id uuid,
  automation_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint tasks_tenant_id_id_unique unique (tenant_id, id),
  constraint tasks_assigned_user_tenant_fkey
    foreign key (tenant_id, assigned_user_id)
    references tenant_users(tenant_id, id)
    on delete restrict,
  constraint tasks_assigned_team_tenant_fkey
    foreign key (tenant_id, assigned_team_id)
    references teams(tenant_id, id)
    on delete restrict,
  constraint tasks_source_event_tenant_fkey
    foreign key (tenant_id, source_event_id)
    references domain_events(tenant_id, id)
    on delete restrict,
  constraint tasks_task_type_check
    check (task_type in ('PICKUP', 'VERIFY_INTAKE', 'RECEIVE_MANIFEST', 'INVESTIGATE_VARIANCE', 'PROCESS_WORK_UNIT', 'DELIVERY', 'COLLECT_PAYMENT', 'RECONCILE_PAYMENT', 'GENERAL')),
  constraint tasks_subject_type_check
    check (subject_type in ('pickup_request', 'handling_unit', 'manifest', 'work_unit', 'order', 'invoice', 'payment', 'delivery', 'collection_batch', 'general')),
  constraint tasks_priority_check check (priority in ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  constraint tasks_status_check check (status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  constraint tasks_source_check check (source in ('OS_PLUS_UI', 'QR_SCAN', 'WHATSAPP', 'TELEGRAM', 'API', 'WEBHOOK', 'AUTOMATION')),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_assigned_status_has_target check (
    status <> 'ASSIGNED'
    or assigned_user_id is not null
    or assigned_team_id is not null
  )
);

create trigger tasks_set_updated_at
before update on tasks
for each row
execute function set_updated_at();

create index tasks_tenant_status_due_idx on tasks(tenant_id, status, due_at);
create index tasks_tenant_assigned_user_status_idx on tasks(tenant_id, assigned_user_id, status);
create index tasks_tenant_assigned_team_status_idx on tasks(tenant_id, assigned_team_id, status);
create index tasks_tenant_type_status_idx on tasks(tenant_id, task_type, status);
create index tasks_tenant_subject_idx on tasks(tenant_id, subject_type, subject_id);

create table task_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id uuid not null,
  event_type text not null,
  old_value_json jsonb,
  new_value_json jsonb,
  actor_type text not null,
  actor_id text,
  source text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint task_history_task_tenant_fkey
    foreign key (tenant_id, task_id)
    references tasks(tenant_id, id)
    on delete cascade,
  constraint task_history_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint task_history_actor_type_check check (actor_type in ('USER', 'SYSTEM', 'AGENT', 'WEBHOOK')),
  constraint task_history_source_check check (source in ('OS_PLUS_UI', 'QR_SCAN', 'WHATSAPP', 'TELEGRAM', 'API', 'WEBHOOK', 'AUTOMATION'))
);

create index task_history_tenant_task_idx on task_history(tenant_id, task_id, created_at);

alter table command_idempotency enable row level security;
alter table domain_events enable row level security;
alter table tasks enable row level security;
alter table task_history enable row level security;

create or replace function prevent_domain_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'DOMAIN_EVENTS_ARE_APPEND_ONLY'
    using errcode = 'P0001';
end;
$$;

create trigger domain_events_append_only_update
before update on domain_events
for each row
execute function prevent_domain_event_mutation();

create trigger domain_events_append_only_delete
before delete on domain_events
for each row
execute function prevent_domain_event_mutation();

create or replace function prevent_task_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'TASK_HISTORY_IS_APPEND_ONLY'
    using errcode = 'P0001';
end;
$$;

create trigger task_history_append_only_update
before update on task_history
for each row
execute function prevent_task_history_mutation();

create trigger task_history_append_only_delete
before delete on task_history
for each row
execute function prevent_task_history_mutation();

create or replace function create_task_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_task_type text,
  p_title text,
  p_description text,
  p_subject_type text,
  p_subject_id uuid,
  p_assigned_user_id uuid default null,
  p_assigned_team_id uuid default null,
  p_priority text default 'NORMAL',
  p_due_at timestamptz default null,
  p_source_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CreateTask';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_status text;
  v_task_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  v_request := jsonb_build_object(
    'task_type', p_task_type,
    'title', p_title,
    'description', p_description,
    'subject_type', p_subject_type,
    'subject_id', p_subject_id,
    'assigned_user_id', p_assigned_user_id,
    'assigned_team_id', p_assigned_team_id,
    'priority', p_priority,
    'due_at', p_due_at,
    'source_event_id', p_source_event_id
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

    insert into command_idempotency (
      tenant_id,
      command_type,
      idempotency_key,
      request_hash,
      status
    )
    values (
      p_tenant_id,
      v_command_type,
      p_idempotency_key,
      v_request_hash,
      'processing'
    );
  end if;

  if p_assigned_user_id is not null then
    perform 1
    from tenant_users
    where tenant_id = p_tenant_id
      and id = p_assigned_user_id
      and status = 'active';

    if not found then
      raise exception 'ASSIGNED_USER_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_assigned_team_id is not null then
    perform 1
    from teams
    where tenant_id = p_tenant_id
      and id = p_assigned_team_id
      and is_active = true
      and deleted_at is null;

    if not found then
      raise exception 'ASSIGNED_TEAM_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_source_event_id is not null then
    perform 1
    from domain_events
    where tenant_id = p_tenant_id
      and id = p_source_event_id;

    if not found then
      raise exception 'SOURCE_EVENT_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  v_status := case
    when p_assigned_user_id is not null or p_assigned_team_id is not null then 'ASSIGNED'
    else 'OPEN'
  end;

  insert into tasks (
    tenant_id,
    task_type,
    title,
    description,
    subject_type,
    subject_id,
    assigned_user_id,
    assigned_team_id,
    priority,
    status,
    due_at,
    source,
    source_event_id,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_task_type,
    p_title,
    p_description,
    p_subject_type,
    p_subject_id,
    p_assigned_user_id,
    p_assigned_team_id,
    p_priority,
    v_status,
    p_due_at,
    p_source,
    p_source_event_id,
    p_actor_id,
    p_actor_id
  )
  returning id into v_task_id;

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
    'task.created',
    'task',
    v_task_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    p_source_event_id,
    v_request || jsonb_build_object('status', v_status)
  )
  returning id into v_event_id;

  insert into task_history (
    tenant_id,
    task_id,
    event_type,
    old_value_json,
    new_value_json,
    actor_type,
    actor_id,
    source
  )
  values (
    p_tenant_id,
    v_task_id,
    'task_created',
    null,
    v_request || jsonb_build_object('status', v_status),
    p_actor_type,
    p_actor_id,
    p_source
  );

  v_result := jsonb_build_object(
    'task_id', v_task_id,
    'event_ids', jsonb_build_array(v_event_id),
    'status', v_status
  );

  if p_idempotency_key is not null then
    update command_idempotency
    set
      status = 'completed',
      result_json = v_result,
      completed_at = now()
    where tenant_id = p_tenant_id
      and command_type = v_command_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_result;
end;
$$;

create or replace function assign_task_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_task_id uuid,
  p_assigned_user_id uuid default null,
  p_assigned_team_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'AssignTask';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_task tasks%rowtype;
  v_event_id uuid;
  v_result jsonb;
begin
  if p_assigned_user_id is null and p_assigned_team_id is null then
    raise exception 'TASK_ASSIGNMENT_REQUIRED'
      using errcode = 'P0001';
  end if;

  v_request := jsonb_build_object(
    'task_id', p_task_id,
    'assigned_user_id', p_assigned_user_id,
    'assigned_team_id', p_assigned_team_id,
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
  into v_task
  from tasks
  where tenant_id = p_tenant_id
    and id = p_task_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_task.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'TASK_NOT_ASSIGNABLE'
      using errcode = 'P0001';
  end if;

  if p_assigned_user_id is not null then
    perform 1
    from tenant_users
    where tenant_id = p_tenant_id
      and id = p_assigned_user_id
      and status = 'active';

    if not found then
      raise exception 'ASSIGNED_USER_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  if p_assigned_team_id is not null then
    perform 1
    from teams
    where tenant_id = p_tenant_id
      and id = p_assigned_team_id
      and is_active = true
      and deleted_at is null;

    if not found then
      raise exception 'ASSIGNED_TEAM_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  update tasks
  set
    assigned_user_id = p_assigned_user_id,
    assigned_team_id = p_assigned_team_id,
    status = 'ASSIGNED',
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_task_id;

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
    'task.assigned',
    'task',
    p_task_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    v_request || jsonb_build_object('old_status', v_task.status, 'new_status', 'ASSIGNED')
  )
  returning id into v_event_id;

  insert into task_history (
    tenant_id,
    task_id,
    event_type,
    old_value_json,
    new_value_json,
    actor_type,
    actor_id,
    source,
    notes
  )
  values (
    p_tenant_id,
    p_task_id,
    'task_assigned',
    jsonb_build_object(
      'assigned_user_id', v_task.assigned_user_id,
      'assigned_team_id', v_task.assigned_team_id,
      'status', v_task.status
    ),
    jsonb_build_object(
      'assigned_user_id', p_assigned_user_id,
      'assigned_team_id', p_assigned_team_id,
      'status', 'ASSIGNED'
    ),
    p_actor_type,
    p_actor_id,
    p_source,
    p_notes
  );

  v_result := jsonb_build_object('task_id', p_task_id, 'event_ids', jsonb_build_array(v_event_id), 'status', 'ASSIGNED');

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

create or replace function start_task_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_task_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'StartTask';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_task tasks%rowtype;
  v_event_id uuid;
  v_result jsonb;
  v_now timestamptz := now();
begin
  v_request := jsonb_build_object('task_id', p_task_id, 'notes', p_notes);
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
  into v_task
  from tasks
  where tenant_id = p_tenant_id
    and id = p_task_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_task.status not in ('OPEN', 'ASSIGNED', 'BLOCKED') then
    raise exception 'TASK_NOT_STARTABLE'
      using errcode = 'P0001';
  end if;

  update tasks
  set
    status = 'IN_PROGRESS',
    started_at = coalesce(started_at, v_now),
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_task_id;

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
    'task.started',
    'task',
    p_task_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    jsonb_build_object('old_status', v_task.status, 'new_status', 'IN_PROGRESS')
  )
  returning id into v_event_id;

  insert into task_history (
    tenant_id,
    task_id,
    event_type,
    old_value_json,
    new_value_json,
    actor_type,
    actor_id,
    source,
    notes
  )
  values (
    p_tenant_id,
    p_task_id,
    'task_started',
    jsonb_build_object('status', v_task.status),
    jsonb_build_object('status', 'IN_PROGRESS', 'started_at', v_now),
    p_actor_type,
    p_actor_id,
    p_source,
    p_notes
  );

  v_result := jsonb_build_object('task_id', p_task_id, 'event_ids', jsonb_build_array(v_event_id), 'status', 'IN_PROGRESS');

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

create or replace function complete_task_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_task_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CompleteTask';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_task tasks%rowtype;
  v_event_id uuid;
  v_result jsonb;
  v_now timestamptz := now();
begin
  v_request := jsonb_build_object('task_id', p_task_id, 'notes', p_notes);
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
  into v_task
  from tasks
  where tenant_id = p_tenant_id
    and id = p_task_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_task.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'TASK_NOT_COMPLETABLE'
      using errcode = 'P0001';
  end if;

  update tasks
  set
    status = 'COMPLETED',
    completed_at = v_now,
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_task_id;

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
    'task.completed',
    'task',
    p_task_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    jsonb_build_object('old_status', v_task.status, 'new_status', 'COMPLETED')
  )
  returning id into v_event_id;

  insert into task_history (
    tenant_id,
    task_id,
    event_type,
    old_value_json,
    new_value_json,
    actor_type,
    actor_id,
    source,
    notes
  )
  values (
    p_tenant_id,
    p_task_id,
    'task_completed',
    jsonb_build_object('status', v_task.status),
    jsonb_build_object('status', 'COMPLETED', 'completed_at', v_now),
    p_actor_type,
    p_actor_id,
    p_source,
    p_notes
  );

  v_result := jsonb_build_object('task_id', p_task_id, 'event_ids', jsonb_build_array(v_event_id), 'status', 'COMPLETED');

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

create or replace function cancel_task_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_task_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CancelTask';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_task tasks%rowtype;
  v_event_id uuid;
  v_result jsonb;
  v_now timestamptz := now();
begin
  v_request := jsonb_build_object('task_id', p_task_id, 'notes', p_notes);
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
  into v_task
  from tasks
  where tenant_id = p_tenant_id
    and id = p_task_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_task.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'TASK_NOT_CANCELABLE'
      using errcode = 'P0001';
  end if;

  update tasks
  set
    status = 'CANCELLED',
    completed_at = v_now,
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_task_id;

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
    'task.cancelled',
    'task',
    p_task_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    jsonb_build_object('old_status', v_task.status, 'new_status', 'CANCELLED')
  )
  returning id into v_event_id;

  insert into task_history (
    tenant_id,
    task_id,
    event_type,
    old_value_json,
    new_value_json,
    actor_type,
    actor_id,
    source,
    notes
  )
  values (
    p_tenant_id,
    p_task_id,
    'task_cancelled',
    jsonb_build_object('status', v_task.status),
    jsonb_build_object('status', 'CANCELLED', 'completed_at', v_now),
    p_actor_type,
    p_actor_id,
    p_source,
    p_notes
  );

  v_result := jsonb_build_object('task_id', p_task_id, 'event_ids', jsonb_build_array(v_event_id), 'status', 'CANCELLED');

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

create or replace function start_work_unit_stage_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_stage_instance_id uuid,
  p_worker_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'StartWorkUnitStage';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_stage work_unit_stage_instances%rowtype;
  v_log_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  v_request := jsonb_build_object(
    'stage_instance_id', p_stage_instance_id,
    'worker_id', p_worker_id,
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
  into v_stage
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and id = p_stage_instance_id
    and deleted_at is null;

  if not found then
    raise exception 'WORK_UNIT_STAGE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  select start_work_unit_stage(p_tenant_id, p_stage_instance_id, p_worker_id, p_actor_id, p_notes)
  into v_log_id;

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
    'work_unit.stage_started',
    'work_unit',
    v_stage.work_unit_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    jsonb_build_object(
      'stage_instance_id', p_stage_instance_id,
      'worker_id', p_worker_id,
      'work_log_id', v_log_id,
      'notes', p_notes
    )
  )
  returning id into v_event_id;

  v_result := jsonb_build_object(
    'work_unit_id', v_stage.work_unit_id,
    'stage_instance_id', p_stage_instance_id,
    'work_log_id', v_log_id,
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

create or replace function complete_work_unit_stage_command(
  p_tenant_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_source text,
  p_correlation_id text,
  p_idempotency_key text,
  p_stage_instance_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'CompleteWorkUnitStage';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_stage work_unit_stage_instances%rowtype;
  v_next_stage_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  v_request := jsonb_build_object(
    'stage_instance_id', p_stage_instance_id,
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
  into v_stage
  from work_unit_stage_instances
  where tenant_id = p_tenant_id
    and id = p_stage_instance_id
    and deleted_at is null;

  if not found then
    raise exception 'WORK_UNIT_STAGE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  select complete_work_unit_stage(p_tenant_id, p_stage_instance_id, p_actor_id, p_notes)
  into v_next_stage_id;

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
    'work_unit.stage_completed',
    'work_unit',
    v_stage.work_unit_id,
    p_actor_type,
    p_actor_id,
    p_source,
    p_correlation_id,
    jsonb_build_object(
      'stage_instance_id', p_stage_instance_id,
      'next_stage_instance_id', v_next_stage_id,
      'notes', p_notes
    )
  )
  returning id into v_event_id;

  v_result := jsonb_build_object(
    'work_unit_id', v_stage.work_unit_id,
    'stage_instance_id', p_stage_instance_id,
    'next_stage_instance_id', v_next_stage_id,
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

comment on table command_idempotency is 'Tenant-owned V2 command idempotency records. Repeated completed keys return the saved command result.';
comment on table domain_events is 'Append-only V2 Domain Events emitted by successful Domain Commands. Current-state tables remain source of truth.';
comment on table tasks is 'Tenant-owned V2 operational tasks assigned to users or teams. Tasks represent work to do, not current business state.';
comment on table task_history is 'Append-only task audit trail written by task Domain Commands.';
comment on function create_task_command(uuid, text, text, text, text, text, text, text, text, text, uuid, uuid, uuid, text, timestamptz, uuid)
is 'Atomically creates a task, task history row, domain event, and optional idempotency result.';
comment on function assign_task_command(uuid, text, text, text, text, text, uuid, uuid, uuid, text)
is 'Atomically assigns a task to a tenant user and/or team with task history, domain event, and optional idempotency.';
comment on function start_task_command(uuid, text, text, text, text, text, uuid, text)
is 'Atomically starts a task with task history, domain event, and optional idempotency.';
comment on function complete_task_command(uuid, text, text, text, text, text, uuid, text)
is 'Atomically completes a task with task history, domain event, and optional idempotency.';
comment on function cancel_task_command(uuid, text, text, text, text, text, uuid, text)
is 'Atomically cancels a task with task history, domain event, and optional idempotency.';
comment on function start_work_unit_stage_command(uuid, text, text, text, text, text, uuid, uuid, text)
is 'V2 Domain Command wrapper for starting a Work Unit stage. Writes current state, work log, domain event, and idempotency atomically.';
comment on function complete_work_unit_stage_command(uuid, text, text, text, text, text, uuid, text)
is 'V2 Domain Command wrapper for completing a Work Unit stage. Writes current state, domain event, and idempotency atomically.';
